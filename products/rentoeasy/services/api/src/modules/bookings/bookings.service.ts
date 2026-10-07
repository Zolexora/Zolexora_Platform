import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, Logger,
} from '@nestjs/common'
import { PrismaService }    from '../../prisma/prisma.service'
import { AgreementService } from './agreement.service'
import {
  CreateBookingDto, RespondBookingDto, CancelBookingDto,
  UpdatePoliceVerificationDto, AdminBookingQueryDto,
} from './dto/bookings.dto'

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name)

  constructor(
    private prisma:     PrismaService,
    private agreement:  AgreementService,
  ) {}

  // ─── TENANT — CREATE BOOKING REQUEST ────────────────────────────────────────

  async create(tenantId: string, dto: CreateBookingDto) {
    // 1. Tenant must have Aadhaar verified
    const tenant = await this.prisma.user.findUnique({
      where:  { id: tenantId },
      select: { aadhaarVerified: true, isActive: true, name: true, phone: true,
                permanentAddress: true, kycDocuments: true },
    })
    if (!tenant?.isActive)       throw new ForbiddenException('Account is suspended')
    if (!tenant.aadhaarVerified) throw new ForbiddenException('Complete Aadhaar verification before booking')

    // 2. Property must exist and be active
    const property = await this.prisma.property.findUnique({
      where:   { id: dto.propertyId },
      include: { owner: { select: { id: true, isActive: true } } },
    })
    if (!property || property.status !== 'active') {
      throw new NotFoundException('Property not available for booking')
    }
    if (property.ownerId === tenantId) {
      throw new BadRequestException('You cannot book your own property')
    }

    // 3. No duplicate pending/active booking for same property by same tenant
    const existing = await this.prisma.booking.findFirst({
      where: {
        propertyId: dto.propertyId,
        tenantId,
        status: { in: ['pending', 'accepted', 'active'] },
      },
    })
    if (existing) throw new BadRequestException('You already have an active or pending booking for this property')

    // 4. Create booking
    const booking = await this.prisma.booking.create({
      data: {
        propertyId:     dto.propertyId,
        tenantId,
        ownerId:        property.ownerId,
        moveInDate:     new Date(dto.moveInDate),
        monthlyRent:    property.monthlyRent,
        securityDeposit: property.securityDeposit,
        status:         'pending',
      },
      include: this.fullInclude(),
    })

    this.logger.log(`Booking created: ${booking.id} by tenant ${tenantId}`)
    return booking
  }

  // ─── OWNER — ACCEPT OR REJECT ────────────────────────────────────────────────

  async respond(ownerId: string, bookingId: string, dto: RespondBookingDto) {
    const booking = await this.assertOwnerBooking(ownerId, bookingId, ['pending'])

    if (dto.action === 'rejected') {
      const updated = await this.prisma.booking.update({
        where: { id: bookingId },
        data:  { status: 'rejected', rejectionReason: dto.reason },
        include: this.fullInclude(),
      })
      this.logger.log(`Booking ${bookingId} rejected by owner ${ownerId}`)
      return updated
    }

    // Accepting — generate agreement and send for eSign
    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data:  { status: 'accepted' },
      include: this.fullInclude(),
    })

    // Create chat room between tenant and owner
    await this.prisma.chatRoom.upsert({
      where:  { bookingId },
      create: { bookingId, tenantId: booking.tenantId, ownerId },
      update: {},
    })

    // Trigger agreement generation
    try {
      await this.generateAgreement(bookingId)
    } catch (err) {
      this.logger.error(`Agreement generation failed for ${bookingId}: ${err}`)
      // Don't fail the accept — agreement can be retried
    }

    this.logger.log(`Booking ${bookingId} accepted by owner ${ownerId}`)
    return updated
  }

  // ─── GENERATE + SEND AGREEMENT FOR ESIGN ─────────────────────────────────────

  async generateAgreement(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where:   { id: bookingId },
      include: {
        tenant: {
          include: {
            kycDocuments: { where: { type: 'aadhaar', status: 'verified' } },
          },
        },
        owner: {
          include: {
            kycDocuments: { where: { type: 'aadhaar', status: 'verified' } },
          },
        },
        property: true,
      },
    })
    if (!booking) throw new NotFoundException('Booking not found')

    // Extract Aadhaar last 4 from KYC verified data
    const tenantAadhaarDoc = booking.tenant.kycDocuments[0]
    const ownerAadhaarDoc  = booking.owner.kycDocuments[0]

    const tenantAadhaarLast4 = (tenantAadhaarDoc?.verifiedData as any)?.aadhaarLastFour
    const ownerAadhaarLast4  = (ownerAadhaarDoc?.verifiedData  as any)?.aadhaarLastFour

    const eSign = await this.agreement.createESignRequest(
      bookingId,
      {
        owner: {
          name:            booking.owner.name,
          address:         booking.property.addressLine1 + ', ' + booking.property.city,
          phone:           booking.owner.phone,
          aadhaarLastFour: ownerAadhaarLast4,
        },
        tenant: {
          name:             booking.tenant.name,
          permanentAddress: booking.tenant.permanentAddress ?? booking.property.addressLine1,
          phone:            booking.tenant.phone,
          aadhaarLastFour:  tenantAadhaarLast4,
        },
      },
      {
        propertyAddress: `${booking.property.addressLine1}${booking.property.addressLine2 ? ', ' + booking.property.addressLine2 : ''}`,
        propertyCity:    booking.property.city,
        propertyState:   booking.property.state,
        monthlyRent:     booking.monthlyRent,
        securityDeposit: booking.securityDeposit,
        moveInDate:      booking.moveInDate.toISOString(),
        durationMonths:  11,         // standard 11-month leave & licence
        rules:           booking.property.rules ?? undefined,
      },
    )

    // Store eSign request ID and signing URLs
    await this.prisma.booking.update({
      where: { id: bookingId },
      data:  {
        // Store in verifiedData-style JSON via agreementUrl temporarily
        agreementUrl: JSON.stringify({
          digioRequestId: eSign.requestId,
          ownerSignUrl:   eSign.signingUrl.owner,
          tenantSignUrl:  eSign.signingUrl.tenant,
          generatedAt:    new Date().toISOString(),
        }),
      },
    })

    this.logger.log(`Agreement eSign request created: ${eSign.requestId} for booking ${bookingId}`)
    return eSign
  }

  // ─── GET SIGNING URL (for in-app sign button) ─────────────────────────────────

  async getSigningUrl(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } })
    if (!booking)                          throw new NotFoundException('Booking not found')
    if (booking.tenantId !== userId && booking.ownerId !== userId) {
      throw new ForbiddenException('Access denied')
    }
    if (!booking.agreementUrl)             throw new BadRequestException('Agreement not generated yet')

    const meta    = JSON.parse(booking.agreementUrl)
    const isOwner = booking.ownerId === userId
    const url     = isOwner ? meta.ownerSignUrl : meta.tenantSignUrl

    return { signingUrl: url, role: isOwner ? 'owner' : 'tenant' }
  }

  // ─── DIGIO WEBHOOK — agreement fully signed ───────────────────────────────────

  async handleAgreementWebhook(payload: any) {
    const { id: requestId, status } = payload ?? {}
    if (!requestId) return { received: true }

    // Find booking with this Digio request ID
    const bookings = await this.prisma.booking.findMany({
      where: { agreementUrl: { contains: requestId } },
    })

    for (const booking of bookings) {
      if (status === 'completed') {
        // Both parties signed — move to active, store signed PDF URL
        await this.prisma.booking.update({
          where: { id: booking.id },
          data:  {
            status:           'active',
            agreementSignedAt: new Date(),
            agreementUrl:      payload.signed_file_url ?? booking.agreementUrl,
            agreementSignedByOwner:  true,
            agreementSignedByTenant: true,
          },
        })

        // Mark property as occupied
        await this.prisma.property.update({
          where: { id: booking.propertyId },
          data:  { status: 'occupied' },
        })

        // Schedule first rent payment due
        await this.scheduleFirstRentDue(booking.id)

        this.logger.log(`Booking ${booking.id} is now ACTIVE — agreement signed`)
      } else if (status === 'signer_signed') {
        // Track individual signatures
        const signerPhone = payload.signer_identifier?.replace('91', '')
        const isOwner     = booking.ownerId && signerPhone === (
          await this.prisma.user.findUnique({ where: { id: booking.ownerId }, select: { phone: true } })
        )?.phone

        await this.prisma.booking.update({
          where: { id: booking.id },
          data:  isOwner
            ? { agreementSignedByOwner: true }
            : { agreementSignedByTenant: true },
        })
      }
    }

    return { received: true }
  }

  // ─── CANCEL BOOKING ──────────────────────────────────────────────────────────

  async cancel(userId: string, bookingId: string, dto: CancelBookingDto) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } })
    if (!booking) throw new NotFoundException('Booking not found')

    const isParty = booking.tenantId === userId || booking.ownerId === userId
    if (!isParty)  throw new ForbiddenException('Access denied')

    const cancellable = ['pending', 'accepted']
    if (!cancellable.includes(booking.status)) {
      throw new BadRequestException(`Cannot cancel a booking with status: ${booking.status}`)
    }

    await this.prisma.booking.update({
      where: { id: bookingId },
      data:  { status: 'cancelled', cancelledBy: userId, cancelReason: dto.reason },
    })

    // Re-activate property if it was accepted
    if (booking.status === 'accepted') {
      await this.prisma.property.update({
        where: { id: booking.propertyId },
        data:  { status: 'active' },
      })
    }

    return { message: 'Booking cancelled successfully' }
  }

  // ─── POLICE VERIFICATION FORM ────────────────────────────────────────────────

  async getPoliceVerificationData(ownerId: string, bookingId: string) {
    const booking = await this.assertOwnerBooking(ownerId, bookingId, ['active'])

    const [tenant, property, owner] = await Promise.all([
      this.prisma.user.findUnique({
        where:   { id: booking.tenantId },
        include: { kycDocuments: { where: { type: 'aadhaar', status: 'verified' } } },
      }),
      this.prisma.property.findUnique({ where: { id: booking.propertyId } }),
      this.prisma.user.findUnique({
        where:  { id: ownerId },
        select: { name: true, phone: true, permanentAddress: true },
      }),
    ])

    if (!tenant || !property || !owner) throw new NotFoundException('Booking data incomplete')

    const tenantAadhaarLast4 = (tenant.kycDocuments[0]?.verifiedData as any)?.aadhaarLastFour

    return this.agreement.buildPoliceVerificationData({
      owner: {
        name:    owner.name,
        phone:   owner.phone,
        address: property.addressLine1 + ', ' + property.city,
      },
      tenant: {
        name:             tenant.name,
        phone:            tenant.phone,
        permanentAddress: tenant.permanentAddress ?? 'Not provided',
        aadhaarLastFour:  tenantAadhaarLast4,
        photo:            tenant.profilePhoto ?? undefined,
      },
      property: {
        address: property.addressLine1,
        city:    property.city,
        state:   property.state,
        pincode: property.pincode,
      },
      booking: {
        moveInDate:  booking.moveInDate.toISOString(),
        monthlyRent: booking.monthlyRent,
      },
    })
  }

  async updatePoliceVerification(
    ownerId: string, bookingId: string, dto: UpdatePoliceVerificationDto,
  ) {
    await this.assertOwnerBooking(ownerId, bookingId, ['active'])
    await this.prisma.booking.update({
      where: { id: bookingId },
      data:  { policeVerificationStatus: dto.status as any },
    })
    return { message: `Police verification marked as ${dto.status}` }
  }

  // ─── GET ONE ─────────────────────────────────────────────────────────────────

  async findOne(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where:   { id: bookingId },
      include: this.fullInclude(),
    })
    if (!booking) throw new NotFoundException('Booking not found')

    const isParty = booking.tenantId === userId || booking.ownerId === userId
    if (!isParty) throw new ForbiddenException('Access denied')

    return booking
  }

  // ─── TENANT — MY BOOKINGS ────────────────────────────────────────────────────

  async tenantBookings(tenantId: string, status?: string, page = 1, limit = 10) {
    const skip  = (page - 1) * limit
    const where: any = { tenantId }
    if (status) where.status = status

    const [data, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: this.listInclude(),
      }),
      this.prisma.booking.count({ where }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  // ─── OWNER — MY BOOKINGS ─────────────────────────────────────────────────────

  async ownerBookings(ownerId: string, status?: string, page = 1, limit = 10) {
    const skip  = (page - 1) * limit
    const where: any = { ownerId }
    if (status) where.status = status

    const [data, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: this.listInclude(),
      }),
      this.prisma.booking.count({ where }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  // ─── ADMIN ───────────────────────────────────────────────────────────────────

  async adminList(dto: AdminBookingQueryDto) {
    const page  = dto.page  ?? 1
    const limit = dto.limit ?? 20
    const skip  = (page - 1) * limit
    const where: any = {}
    if (dto.status)     where.status     = dto.status
    if (dto.tenantId)   where.tenantId   = dto.tenantId
    if (dto.ownerId)    where.ownerId    = dto.ownerId
    if (dto.propertyId) where.propertyId = dto.propertyId

    const [data, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: this.listInclude(),
      }),
      this.prisma.booking.count({ where }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  // ─── PRIVATE HELPERS ──────────────────────────────────────────────────────────

  private async scheduleFirstRentDue(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } })
    if (!booking) return

    // First rent due on 1st of next month after move-in
    const moveIn  = new Date(booking.moveInDate)
    const dueDate = new Date(moveIn.getFullYear(), moveIn.getMonth() + 1, 1)

    await this.prisma.payment.create({
      data: {
        bookingId,
        tenantId:        booking.tenantId,
        ownerId:         booking.ownerId,
        amountPaise:     booking.monthlyRent     * 100,
        platformFeePaise: Math.round(booking.monthlyRent * 0.02) * 100,
        ownerAmountPaise: Math.round(booking.monthlyRent * 0.98) * 100,
        type:            'rent',
        status:          'pending',
        dueDate,
      },
    })

    // Security deposit payment also created if not already paid
    await this.prisma.payment.create({
      data: {
        bookingId,
        tenantId:        booking.tenantId,
        ownerId:         booking.ownerId,
        amountPaise:     booking.securityDeposit * 100,
        platformFeePaise: 0,
        ownerAmountPaise: booking.securityDeposit * 100,
        type:            'security_deposit',
        status:          'pending',
        dueDate:         new Date(), // due immediately
      },
    })
  }

  private async assertOwnerBooking(
    ownerId: string, bookingId: string, allowedStatuses: string[],
  ) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } })
    if (!booking)                    throw new NotFoundException('Booking not found')
    if (booking.ownerId !== ownerId) throw new ForbiddenException('Access denied')
    if (!allowedStatuses.includes(booking.status)) {
      throw new BadRequestException(
        `Action not allowed for booking status: ${booking.status}`,
      )
    }
    return booking
  }

  private fullInclude() {
    return {
      property: { include: { photos: { where: { isPrimary: true }, take: 1 } } },
      tenant:   { select: { id: true, name: true, profilePhoto: true, phone: true, city: true, kycStatus: true } },
      owner:    { select: { id: true, name: true, profilePhoto: true, phone: true } },
    }
  }

  private listInclude() {
    return {
      property: { select: { id: true, title: true, city: true, monthlyRent: true,
        photos: { where: { isPrimary: true }, take: 1 } } },
      tenant:   { select: { id: true, name: true, profilePhoto: true, phone: true } },
      owner:    { select: { id: true, name: true, profilePhoto: true } },
    }
  }
}
