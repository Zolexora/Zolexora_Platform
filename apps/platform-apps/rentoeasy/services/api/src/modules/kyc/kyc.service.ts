import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PDFDocument } from 'pdf-lib'
import axios from 'axios'
import FormData from 'form-data'
import { PrismaService } from '../../prisma/prisma.service'
import { UploadService } from '../../config/upload.service'
import { generateAadhaarPasswords } from '@zolexora/rentoeasy-utils'
import { VerifyPANDto, VerifyBankDto, AdminKYCActionDto } from './dto/kyc.dto'

@Injectable()
export class KYCService {
  private readonly logger = new Logger(KYCService.name)

  private get digioBase() {
    return this.config.get('DIGIO_ENV') === 'production'
      ? 'https://api.digio.in'
      : 'https://ext.digio.in:444'
  }

  private get digioAuth() {
    const id     = this.config.get('DIGIO_CLIENT_ID')
    const secret = this.config.get('DIGIO_CLIENT_SECRET')
    return Buffer.from(`${id}:${secret}`).toString('base64')
  }

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private upload: UploadService,
  ) {}

  // ─── GET KYC STATUS ──────────────────────────────────────────────────────────

  async getStatus(userId: string) {
    const [user, docs] = await Promise.all([
      this.prisma.user.findUnique({
        where:  { id: userId },
        select: {
          role: true, kycStatus: true,
          aadhaarVerified: true, panVerified: true, bankVerified: true,
          bankAccountNumber: true, bankAccountName: true, bankIfsc: true,
        },
      }),
      this.prisma.kYCDocument.findMany({
        where:  { userId },
        select: { type: true, status: true, rejectionReason: true, updatedAt: true },
      }),
    ])

    if (!user) throw new NotFoundException('User not found')

    return {
      overall:          user.kycStatus,
      aadhaarVerified:  user.aadhaarVerified,
      panVerified:      user.panVerified,
      bankVerified:     user.bankVerified,
      bankAccountMasked: user.bankAccountNumber ? `XXXX${user.bankAccountNumber.slice(-4)}` : null,
      bankAccountName:  user.bankAccountName,
      bankIfsc:         user.bankIfsc,
      documents:        docs,
      pendingSteps:     this.calcPendingSteps(user, docs),
    }
  }

  // ─── AADHAAR PDF — AUTO UNLOCK + DIGIO ───────────────────────────────────────

  async processAadhaar(
    userId: string,
    pdfBuffer: Buffer,
    mimeType: string,
    userMeta: { name: string; dob: string },
  ) {
    if (mimeType !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are accepted for Aadhaar verification')
    }

    // 1. Check encryption
    let finalBuffer  = pdfBuffer
    const isEncrypted = await this.checkEncrypted(pdfBuffer)

    if (isEncrypted) {
      const unlocked = await this.autoUnlock(pdfBuffer, userMeta.name, userMeta.dob)
      if (!unlocked) {
        throw new BadRequestException({
          code:    'PDF_UNLOCK_FAILED',
          message: 'Could not unlock your Aadhaar PDF automatically',
          action:  'ASK_USER',
        })
      }
      finalBuffer = unlocked
    }

    // 2. Store original (encrypted) PDF in S3 — audit trail
    const { key: s3Key } = await this.upload.uploadPDF(pdfBuffer, 'application/pdf', 'aadhaar')

    // 3. Send unlocked buffer to Digio — never store unlocked version
    const digio = await this.callDigio(finalBuffer, userId)

    // 4. Save KYC record
    await this.prisma.kYCDocument.upsert({
      where:  { userId_type: { userId, type: 'aadhaar' } },
      create: {
        userId, type: 'aadhaar', status: 'submitted',
        digioRequestId: digio.requestId,
        verifiedData:   { ...digio.extracted, s3Key },
      },
      update: {
        status: 'submitted', digioRequestId: digio.requestId,
        verifiedData: { ...digio.extracted, s3Key }, rejectionReason: null,
      },
    })

    await this.recalcOverall(userId)

    return {
      message:   'Aadhaar submitted for verification',
      requestId: digio.requestId,
      status:    'submitted',
      extracted: digio.extracted,
    }
  }

  // ─── AADHAAR FALLBACK — user provides name + year ────────────────────────────

  async processAadhaarWithHint(
    userId: string,
    pdfBuffer: Buffer,
    nameOnAadhaar: string,
    birthYear: string,
  ) {
    return this.processAadhaar(userId, pdfBuffer, 'application/pdf', {
      name: nameOnAadhaar,
      dob:  `${birthYear}-01-01`,
    })
  }

  // ─── DIGIO WEBHOOK ────────────────────────────────────────────────────────────

  async handleWebhook(payload: any) {
    const { id: requestId, status, customer_identifier: userId } = payload ?? {}
    if (!requestId || !userId) return { received: true }

    const doc = await this.prisma.kYCDocument.findFirst({
      where: { digioRequestId: requestId },
    })
    if (!doc) return { received: true }

    const newStatus = status === 'completed' ? 'verified' : 'rejected'

    await this.prisma.kYCDocument.update({
      where: { id: doc.id },
      data:  {
        status: newStatus as any,
        rejectionReason: newStatus === 'rejected' ? (payload.message ?? 'Verification failed') : null,
        verifiedData: { ...(doc.verifiedData as object ?? {}), digioStatus: status },
      },
    })

    if (newStatus === 'verified') {
      const field: any = doc.type === 'aadhaar' ? { aadhaarVerified: true }
        : doc.type === 'pan'          ? { panVerified: true }
        : doc.type === 'bank_account' ? { bankVerified: true }
        : {}
      if (Object.keys(field).length) {
        await this.prisma.user.update({ where: { id: doc.userId }, data: field })
      }
    }

    await this.recalcOverall(doc.userId)
    return { received: true }
  }

  // ─── PAN VERIFICATION ────────────────────────────────────────────────────────

  async verifyPAN(userId: string, dto: VerifyPANDto) {
    const pan = dto.panNumber.toUpperCase().trim()

    const already = await this.prisma.kYCDocument.findFirst({
      where: { userId, type: 'pan', status: 'verified' },
    })
    if (already) throw new BadRequestException('PAN already verified for this account')

    let verified = false
    let name     = ''

    try {
      const res = await axios.post(
        `${this.digioBase}/client/kyc/pan/verify`,
        { pan, customer_identifier: userId },
        { headers: { Authorization: `Basic ${this.digioAuth}` }, timeout: 10000 },
      )
      verified = res.data.status === 'valid'
      name     = res.data.name ?? ''
    } catch (err: any) {
      this.logger.error(`Digio PAN error: ${err?.response?.data ?? err?.message}`)
      throw new BadRequestException('PAN verification service unavailable. Please try again.')
    }

    const docStatus = verified ? 'verified' : 'rejected'
    await this.prisma.kYCDocument.upsert({
      where:  { userId_type: { userId, type: 'pan' } },
      create: { userId, type: 'pan', status: docStatus as any, verifiedData: { pan, name } },
      update: {
        status: docStatus as any, verifiedData: { pan, name },
        rejectionReason: verified ? null : 'PAN not found in CBDT database',
      },
    })

    if (verified) {
      await this.prisma.user.update({
        where: { id: userId },
        data:  { panNumber: pan, panVerified: true },
      })
    }

    await this.recalcOverall(userId)

    if (!verified) {
      throw new BadRequestException('PAN not found. Check the number and try again.')
    }

    return { verified: true, nameFromPAN: name, message: 'PAN verified successfully' }
  }

  // ─── BANK ACCOUNT — PENNY DROP ────────────────────────────────────────────────

  async verifyBank(userId: string, dto: VerifyBankDto) {
    const ifsc   = dto.ifsc.toUpperCase().trim()
    const rzpKey = this.config.get('RAZORPAY_KEY_ID')
    const rzpSec = this.config.get('RAZORPAY_KEY_SECRET')
    const auth   = Buffer.from(`${rzpKey}:${rzpSec}`).toString('base64')

    let verified  = false
    let holderName = ''

    try {
      const res = await axios.post(
        'https://api.razorpay.com/v1/payments/validate/account',
        { account_number: dto.accountNumber, ifsc },
        { headers: { Authorization: `Basic ${auth}` }, timeout: 15000 },
      )
      verified    = !!res.data.registered_name
      holderName  = res.data.registered_name ?? ''
    } catch (err: any) {
      this.logger.error(`Penny drop error: ${err?.response?.data?.error?.description}`)
      throw new BadRequestException('Bank verification failed. Check account number and IFSC.')
    }

    const docStatus = verified ? 'verified' : 'rejected'
    const masked    = `XXXX${dto.accountNumber.slice(-4)}`

    await this.prisma.kYCDocument.upsert({
      where:  { userId_type: { userId, type: 'bank_account' } },
      create: { userId, type: 'bank_account', status: docStatus as any,
        verifiedData: { holderName, ifsc, masked } },
      update: { status: docStatus as any, verifiedData: { holderName, ifsc, masked },
        rejectionReason: verified ? null : 'Account not found or inactive' },
    })

    if (verified) {
      await this.prisma.user.update({
        where: { id: userId },
        data:  { bankAccountNumber: dto.accountNumber, bankIfsc: ifsc,
                 bankAccountName: holderName, bankVerified: true },
      })
    }

    await this.recalcOverall(userId)

    if (!verified) {
      throw new BadRequestException('Bank account not found. Verify account number and IFSC.')
    }

    return { verified: true, accountHolderName: holderName, masked, message: 'Bank account verified' }
  }

  // ─── ADMIN — KYC QUEUE ────────────────────────────────────────────────────────

  async adminQueue(status = 'submitted', page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const [data, total] = await this.prisma.$transaction([
      this.prisma.kYCDocument.findMany({
        where:   { status: status as any },
        skip, take: limit, orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, name: true, phone: true, role: true } } },
      }),
      this.prisma.kYCDocument.count({ where: { status: status as any } }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async adminUpdateStatus(adminId: string, docId: string, dto: AdminKYCActionDto) {
    const doc = await this.prisma.kYCDocument.findUnique({ where: { id: docId } })
    if (!doc) throw new NotFoundException('KYC document not found')

    await this.prisma.kYCDocument.update({
      where: { id: docId },
      data:  { status: dto.status as any, rejectionReason: dto.status === 'rejected' ? dto.reason : null },
    })

    if (dto.status === 'verified') {
      const flag: any = doc.type === 'aadhaar'      ? { aadhaarVerified: true }
                      : doc.type === 'pan'          ? { panVerified: true }
                      : doc.type === 'bank_account' ? { bankVerified: true }
                      : {}
      if (Object.keys(flag).length) {
        await this.prisma.user.update({ where: { id: doc.userId }, data: flag })
      }
    }

    await this.recalcOverall(doc.userId)

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId, actorRole: 'admin',
        action: `KYC_${dto.status.toUpperCase()}`,
        targetType: 'KYCDocument', targetId: docId,
        metadata: { type: doc.type, reason: dto.reason },
      },
    })

    return { message: `KYC document ${dto.status}`, docId }
  }

  // ─── PRIVATE HELPERS ──────────────────────────────────────────────────────────

  private async checkEncrypted(buf: Buffer): Promise<boolean> {
    try {
      await PDFDocument.load(buf, { ignoreEncryption: false })
      return false
    } catch (e: any) {
      const msg = e?.message?.toLowerCase() ?? ''
      if (msg.includes('encrypt') || msg.includes('password')) return true
      throw new BadRequestException('Invalid PDF file. Please upload a valid Aadhaar PDF.')
    }
  }

  private async autoUnlock(buf: Buffer, name: string, dob: string): Promise<Buffer | null> {
    const passwords = generateAadhaarPasswords(name, dob)
    for (const pwd of passwords) {
      try {
        const pdf      = await PDFDocument.load(buf, { password: pwd } as any)
        const unlocked = await pdf.save()
        return Buffer.from(unlocked)
      } catch { continue }
    }
    return null
  }

  private async callDigio(buf: Buffer, userId: string) {
    const form = new FormData()
    form.append('file', buf, { filename: 'aadhaar.pdf', contentType: 'application/pdf' })
    form.append('type', 'aadhaar_offline_xml')
    form.append('customer_identifier', userId)

    try {
      const res = await axios.post(
        `${this.digioBase}/client/kyc/v2/request/with_doc`,
        form,
        { headers: { Authorization: `Basic ${this.digioAuth}`, ...form.getHeaders() }, timeout: 30000 },
      )
      return {
        requestId: res.data.id,
        extracted: {
          name:            res.data.name            ?? null,
          dob:             res.data.date_of_birth   ?? null,
          gender:          res.data.gender          ?? null,
          address:         res.data.address         ?? null,
          pincode:         res.data.pincode         ?? null,
          state:           res.data.state           ?? null,
          aadhaarLastFour: res.data.last_digits     ?? null,
        },
      }
    } catch (err: any) {
      this.logger.error(`Digio API: ${JSON.stringify(err?.response?.data)}`)
      throw new BadRequestException('Verification service unavailable. Please try again in a few minutes.')
    }
  }

  private async recalcOverall(userId: string) {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { role: true, aadhaarVerified: true, panVerified: true, bankVerified: true },
    })
    if (!user) return

    const hasPending  = !!(await this.prisma.kYCDocument.findFirst({ where: { userId, status: { in: ['submitted', 'pending'] } } }))
    const hasRejected = !!(await this.prisma.kYCDocument.findFirst({ where: { userId, status: 'rejected' } }))

    let status: any = 'pending'

    const ownerDone  = user.role === 'owner'  && user.aadhaarVerified && user.panVerified && user.bankVerified
    const tenantDone = user.role === 'tenant' && user.aadhaarVerified

    if (ownerDone || tenantDone) status = 'verified'
    else if (hasRejected)        status = 'rejected'
    else if (hasPending)         status = 'submitted'

    await this.prisma.user.update({ where: { id: userId }, data: { kycStatus: status } })
  }

  private calcPendingSteps(user: any, docs: any[]) {
    const map   = Object.fromEntries(docs.map((d) => [d.type, d.status]))
    const steps: string[] = []

    if (!user.aadhaarVerified) {
      steps.push(map['aadhaar'] === 'submitted' ? 'aadhaar_under_review' : 'upload_aadhaar')
    }
    if (user.role === 'owner') {
      if (!user.panVerified)  steps.push(map['pan']          === 'submitted' ? 'pan_under_review' : 'verify_pan')
      if (!user.bankVerified) steps.push(map['bank_account'] === 'submitted' ? 'bank_under_review' : 'add_bank_account')
    }
    return steps
  }
}
