import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, Logger,
} from '@nestjs/common'
import { PrismaService }   from '../../prisma/prisma.service'
import { RazorpayService } from './razorpay.service'
import { ReceiptService }  from './receipt.service'
import { MSG91Service }    from '../../config/msg91.service'
import {
  CreateOrderDto, VerifyPaymentDto, UPICollectDto,
  SetupAutoPayDto, ManualPayoutDto, RefundDto,
} from './dto/payments.dto'
import { generateReceiptNumber, formatCurrency } from '@rent-stay/utils'

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name)

  constructor(
    private prisma:   PrismaService,
    private rzp:      RazorpayService,
    private receipt:  ReceiptService,
    private msg91:    MSG91Service,
  ) {}

  // ─── GET DUE PAYMENTS FOR TENANT ────────────────────────────────────────────

  async getTenantDuePayments(tenantId: string) {
    const payments = await this.prisma.payment.findMany({
      where:   { tenantId, status: { in: ['pending', 'failed'] } },
      include: {
        booking: {
          include: {
            property: { select: { title: true, addressLine1: true, city: true } },
            owner:    { select: { name: true } },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    })

    return payments.map((p) => ({
      ...p,
      amountRupees:     p.amountPaise / 100,
      platformFeeRupees: p.platformFeePaise / 100,
      isOverdue:        new Date() > p.dueDate,
      daysOverdue:      Math.max(
        0,
        Math.floor((Date.now() - p.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
      ),
    }))
  }

  // ─── GET PAYMENT HISTORY ─────────────────────────────────────────────────────

  async getHistory(userId: string, role: 'tenant' | 'owner', page = 1, limit = 20) {
    const skip  = (page - 1) * limit
    const where = role === 'tenant' ? { tenantId: userId } : { ownerId: userId }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where:   { ...where, status: { not: 'pending' } },
        skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            include: { property: { select: { title: true, city: true } } },
          },
        },
      }),
      this.prisma.payment.count({ where: { ...where, status: { not: 'pending' } } }),
    ])

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  // ─── CREATE RAZORPAY ORDER ───────────────────────────────────────────────────

  async createOrder(tenantId: string, dto: CreateOrderDto) {
    const payment = await this.getVerifiedPayment(tenantId, dto.paymentId)

    if (dto.method === 'upi_direct') {
      if (!dto.upiId) throw new BadRequestException('UPI ID is required for direct UPI payment')
      return this.handleUPIDirect(payment, dto.upiId, tenantId)
    }

    const receiptId = generateReceiptNumber()

    const tenant = await this.prisma.user.findUnique({
      where:  { id: tenantId },
      select: { phone: true, email: true, name: true },
    })

    const order = await this.rzp.createOrder({
      amountPaise:  payment.amountPaise,
      receiptId,
      bookingId:    payment.bookingId,
      paymentId:    payment.id,
      tenantPhone:  tenant!.phone,
      tenantEmail:  tenant?.email ?? undefined,
    })

    // Save receipt number and Razorpay order ID
    await this.prisma.payment.update({
      where: { id: payment.id },
      data:  { razorpayOrderId: order.orderId, receiptNumber: receiptId, status: 'processing' },
    })

    return order
  }

  // ─── UPI DIRECT COLLECT ────────────────────────────────────────────────────

  private async handleUPIDirect(payment: any, upiId: string, tenantId: string) {
    const receiptId = generateReceiptNumber()

    const tenant = await this.prisma.user.findUnique({
      where:  { id: tenantId },
      select: { name: true, phone: true },
    })

    const result = await this.rzp.createUPICollect({
      amountPaise: payment.amountPaise,
      receiptId,
      bookingId:   payment.bookingId,
      paymentId:   payment.id,
      upiId,
      tenantName:  tenant!.name,
      description: `Rent payment for ${new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}`,
    })

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        razorpayOrderId:   result.orderId,
        razorpayPaymentId: result.paymentId,
        receiptNumber:     receiptId,
        status:            'processing',
        method:            'upi',
      },
    })

    return result
  }

  // ─── VERIFY PAYMENT (after Razorpay checkout) ─────────────────────────────────

  async verifyPayment(tenantId: string, dto: VerifyPaymentDto) {
    const isValid = this.rzp.verifySignature({
      orderId:   dto.razorpayOrderId,
      paymentId: dto.razorpayPaymentId,
      signature: dto.razorpaySignature,
    })

    if (!isValid) throw new BadRequestException('Payment signature verification failed')

    // Find payment by Razorpay order ID
    const payment = await this.prisma.payment.findFirst({
      where:   { razorpayOrderId: dto.razorpayOrderId, tenantId },
      include: {
        booking: {
          include: {
            property: { select: { title: true, addressLine1: true, city: true } },
            owner:    { select: { name: true, bankAccountNumber: true, bankIfsc: true, bankAccountName: true } },
            tenant:   { select: { name: true, phone: true, email: true } },
          },
        },
      },
    })

    if (!payment) throw new NotFoundException('Payment record not found')

    // Mark payment successful
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        razorpayPaymentId: dto.razorpayPaymentId,
        razorpaySignature: dto.razorpaySignature,
        status:            'success',
        paidAt:            new Date(),
        method:            (await this.rzp.fetchPayment(dto.razorpayPaymentId) as any)?.method ?? 'upi',
      },
    })

    // Generate and upload receipt
    const period = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })
    const { receiptUrl, receiptNumber } = await this.receipt.generateAndUpload({
      receiptNumber:    payment.receiptNumber ?? generateReceiptNumber(),
      tenantName:       payment.booking.tenant.name,
      tenantPhone:      payment.booking.tenant.phone,
      ownerName:        payment.booking.owner.name,
      propertyAddress:  payment.booking.property.addressLine1,
      propertyCity:     payment.booking.property.city,
      monthlyRent:      payment.amountPaise / 100,
      platformFee:      payment.platformFeePaise / 100,
      paidAt:           new Date(),
      paymentMethod:    'upi',
      razorpayPaymentId: dto.razorpayPaymentId,
      period,
    })

    await this.prisma.payment.update({
      where: { id: payment.id },
      data:  { receiptUrl, receiptNumber },
    })

    // Send receipt via WhatsApp + SMS
    await this.sendPaymentConfirmation(payment, receiptUrl, period)

    // Initiate owner payout (async — don't wait)
    this.initiatePayoutAsync(payment).catch((err) =>
      this.logger.error(`Payout failed for payment ${payment.id}: ${err}`),
    )

    // Schedule next month's rent
    await this.scheduleNextRent(payment)

    this.logger.log(`Payment ${payment.id} verified and completed`)

    return {
      message:       'Payment successful',
      receiptUrl,
      receiptNumber,
      paidAmount:    payment.amountPaise / 100,
    }
  }

  // ─── RAZORPAY WEBHOOK (for UPI direct status updates) ────────────────────────

  async handleWebhook(rawBody: string, signature: string, payload: any) {
    const isValid = this.rzp.verifyWebhookSignature(rawBody, signature)
    if (!isValid) {
      this.logger.warn('Invalid webhook signature received')
      return { received: false }
    }

    const event   = payload?.event
    const rzpPayment = payload?.payload?.payment?.entity

    if (!rzpPayment) return { received: true }

    this.logger.log(`Webhook: ${event} for payment ${rzpPayment.id}`)

    switch (event) {
      case 'payment.captured':
        await this.onPaymentCaptured(rzpPayment)
        break
      case 'payment.failed':
        await this.onPaymentFailed(rzpPayment)
        break
      case 'subscription.charged':
        await this.onSubscriptionCharged(payload?.payload?.subscription?.entity, rzpPayment)
        break
      case 'payout.processed':
        await this.onPayoutProcessed(payload?.payload?.payout?.entity)
        break
      case 'payout.failed':
        await this.onPayoutFailed(payload?.payload?.payout?.entity)
        break
    }

    return { received: true }
  }

  // ─── SETUP AUTO-PAY (recurring mandate) ──────────────────────────────────────

  async setupAutoPay(tenantId: string, dto: SetupAutoPayDto) {
    const booking = await this.prisma.booking.findFirst({
      where:   { id: dto.bookingId, tenantId, status: 'active' },
      include: { tenant: { select: { name: true, phone: true, email: true } } },
    })
    if (!booking) throw new NotFoundException('Active booking not found')

    // Next 1st of month
    const now      = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const mandate = await this.rzp.createMandate({
      bookingId:   dto.bookingId,
      tenantPhone: booking.tenant.phone,
      tenantEmail: booking.tenant.email ?? undefined,
      tenantName:  booking.tenant.name,
      monthlyRent: booking.monthlyRent,
      startDate,
      method:      dto.method as any,
      upiId:       dto.upiId,
    })

    this.logger.log(`Auto-pay mandate created: ${mandate.subscriptionId} for booking ${dto.bookingId}`)

    return {
      ...mandate,
      message: 'Auto-pay setup initiated. Approve the mandate in your UPI/banking app.',
    }
  }

  // ─── OWNER — EARNINGS SUMMARY ─────────────────────────────────────────────────

  async ownerEarnings(ownerId: string) {
    const [total, thisMonth, pending, payouts] = await Promise.all([
      this.prisma.payment.aggregate({
        where:  { ownerId, status: 'success' },
        _sum:   { ownerAmountPaise: true },
        _count: { id: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          ownerId, status: 'success',
          paidAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        _sum: { ownerAmountPaise: true },
      }),
      this.prisma.payout.aggregate({
        where: { ownerId, status: { in: ['pending', 'processing'] } },
        _sum:  { amountPaise: true },
      }),
      this.prisma.payout.findMany({
        where:   { ownerId },
        take:    10,
        orderBy: { createdAt: 'desc' },
        include: { payment: { select: { receiptNumber: true, paidAt: true } } },
      }),
    ])

    return {
      totalEarnedRupees:    (total._sum.ownerAmountPaise ?? 0) / 100,
      totalPayments:        total._count.id,
      thisMonthRupees:      (thisMonth._sum.ownerAmountPaise ?? 0) / 100,
      pendingPayoutRupees:  (pending._sum.amountPaise ?? 0) / 100,
      recentPayouts:        payouts,
    }
  }

  // ─── ADMIN — TRIGGER MANUAL PAYOUT ───────────────────────────────────────────

  async adminManualPayout(adminId: string, dto: ManualPayoutDto) {
    const payment = await this.prisma.payment.findUnique({
      where:   { id: dto.paymentId },
      include: { owner: { select: { name: true, bankAccountNumber: true, bankIfsc: true } } },
    })
    if (!payment) throw new NotFoundException('Payment not found')
    if (payment.status !== 'success') throw new BadRequestException('Payment not yet successful')

    const existingPayout = await this.prisma.payout.findUnique({ where: { paymentId: dto.paymentId } })
    if (existingPayout?.status === 'completed') {
      throw new BadRequestException('Payout already completed for this payment')
    }

    const payout = await this.rzp.initiateOwnerPayout({
      ownerAccountNumber: payment.owner.bankAccountNumber!,
      ownerIfsc:          payment.owner.bankIfsc!,
      ownerName:          payment.owner.name,
      amountPaise:        payment.ownerAmountPaise,
      paymentId:          payment.id,
      bookingId:          payment.bookingId,
      narration:          dto.reason,
    })

    await this.prisma.payout.upsert({
      where:  { paymentId: payment.id },
      create: {
        paymentId:       payment.id,
        ownerId:         payment.ownerId,
        amountPaise:     payment.ownerAmountPaise,
        status:          'processing',
        razorpayPayoutId: payout.payoutId,
      },
      update: { status: 'processing', razorpayPayoutId: payout.payoutId },
    })

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId, actorRole: 'admin',
        action:  'MANUAL_PAYOUT_INITIATED',
        targetType: 'Payment', targetId: dto.paymentId,
        metadata: { payoutId: payout.payoutId, reason: dto.reason },
      },
    })

    return { message: 'Payout initiated', ...payout }
  }

  // ─── ADMIN — REFUND ───────────────────────────────────────────────────────────

  async adminRefund(adminId: string, dto: RefundDto) {
    const payment = await this.prisma.payment.findUnique({ where: { id: dto.paymentId } })
    if (!payment) throw new NotFoundException('Payment not found')
    if (!payment.razorpayPaymentId) throw new BadRequestException('No Razorpay payment to refund')
    if (payment.status !== 'success') throw new BadRequestException('Only successful payments can be refunded')

    const refund = await this.rzp.refund(
      payment.razorpayPaymentId,
      dto.amountPaise,
      { reason: dto.reason, adminId },
    )

    await this.prisma.payment.update({
      where: { id: payment.id },
      data:  { status: 'refunded' },
    })

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId, actorRole: 'admin',
        action:  'PAYMENT_REFUNDED',
        targetType: 'Payment', targetId: dto.paymentId,
        metadata: { refundId: refund.id, amount: dto.amountPaise, reason: dto.reason },
      },
    })

    return { message: 'Refund initiated', refundId: refund.id, amount: (dto.amountPaise ?? payment.amountPaise) / 100 }
  }

  // ─── ADMIN — OVERVIEW ─────────────────────────────────────────────────────────

  async adminOverview() {
    const now          = new Date()
    const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const [total, thisMonth, lastMonth, pending, failed] = await Promise.all([
      this.prisma.payment.aggregate({ where: { status: 'success' }, _sum: { amountPaise: true }, _count: { id: true } }),
      this.prisma.payment.aggregate({ where: { status: 'success', paidAt: { gte: monthStart } }, _sum: { amountPaise: true }, _count: { id: true } }),
      this.prisma.payment.aggregate({ where: { status: 'success', paidAt: { gte: prevMonthStart, lt: monthStart } }, _sum: { amountPaise: true } }),
      this.prisma.payment.count({ where: { status: 'pending', dueDate: { lt: now } } }),
      this.prisma.payment.count({ where: { status: 'failed' } }),
    ])

    const platformRevenue = await this.prisma.payment.aggregate({
      where: { status: 'success' }, _sum: { platformFeePaise: true },
    })

    return {
      totalCollectedRupees:    (total._sum.amountPaise ?? 0) / 100,
      totalTransactions:       total._count.id,
      thisMonthRupees:         (thisMonth._sum.amountPaise ?? 0) / 100,
      thisMonthCount:          thisMonth._count.id,
      lastMonthRupees:         (lastMonth._sum.amountPaise ?? 0) / 100,
      overdueCount:            pending,
      failedCount:             failed,
      platformRevenueRupees:   (platformRevenue._sum.platformFeePaise ?? 0) / 100,
    }
  }

  // ─── PRIVATE HELPERS ──────────────────────────────────────────────────────────

  private async getVerifiedPayment(tenantId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    })
    if (!payment)                    throw new NotFoundException('Payment not found')
    if (payment.tenantId !== tenantId) throw new ForbiddenException('Access denied')
    if (payment.status === 'success') throw new BadRequestException('Payment already completed')
    return payment
  }

  private async initiatePayoutAsync(payment: any) {
    const owner = await this.prisma.user.findUnique({
      where:  { id: payment.ownerId },
      select: { name: true, bankAccountNumber: true, bankIfsc: true },
    })
    if (!owner?.bankAccountNumber || !owner?.bankIfsc) {
      this.logger.warn(`Owner ${payment.ownerId} has no bank account — payout skipped`)
      return
    }

    const payout = await this.rzp.initiateOwnerPayout({
      ownerAccountNumber: owner.bankAccountNumber,
      ownerIfsc:          owner.bankIfsc,
      ownerName:          owner.name,
      amountPaise:        payment.ownerAmountPaise,
      paymentId:          payment.id,
      bookingId:          payment.bookingId,
    })

    await this.prisma.payout.create({
      data: {
        paymentId:        payment.id,
        ownerId:          payment.ownerId,
        amountPaise:      payment.ownerAmountPaise,
        status:           'processing',
        razorpayPayoutId: payout.payoutId,
      },
    })
  }

  private async scheduleNextRent(payment: any) {
    const dueDate = new Date(payment.dueDate)
    const nextDue = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 1)

    // Check if next month's rent already exists
    const exists = await this.prisma.payment.findFirst({
      where: { bookingId: payment.bookingId, type: 'rent', dueDate: nextDue },
    })
    if (exists) return

    const booking = await this.prisma.booking.findUnique({
      where:  { id: payment.bookingId },
      select: { status: true, monthlyRent: true, tenantId: true, ownerId: true },
    })
    if (!booking || booking.status !== 'active') return

    await this.prisma.payment.create({
      data: {
        bookingId:        payment.bookingId,
        tenantId:         booking.tenantId,
        ownerId:          booking.ownerId,
        amountPaise:      booking.monthlyRent * 100,
        platformFeePaise: Math.round(booking.monthlyRent * 0.02) * 100,
        ownerAmountPaise: Math.round(booking.monthlyRent * 0.98) * 100,
        type:             'rent',
        status:           'pending',
        dueDate:          nextDue,
      },
    })

    this.logger.log(`Next rent scheduled for booking ${payment.bookingId}: ${nextDue.toDateString()}`)
  }

  private async sendPaymentConfirmation(payment: any, receiptUrl: string, period: string) {
    const tenant = await this.prisma.user.findUnique({
      where:  { id: payment.tenantId },
      select: { phone: true, name: true },
    })
    if (!tenant) return

    await this.msg91.sendWhatsApp(
      tenant.phone,
      'rent_payment_success',
      {
        name:       tenant.name,
        amount:     `₹${(payment.amountPaise / 100).toLocaleString('en-IN')}`,
        period,
        receipt_url: receiptUrl,
      },
    )
  }

  private async onPaymentCaptured(rzpPayment: any) {
    const p = await this.prisma.payment.findFirst({
      where: { razorpayPaymentId: rzpPayment.id },
    })
    if (p && p.status !== 'success') {
      await this.prisma.payment.update({
        where: { id: p.id },
        data:  { status: 'success', paidAt: new Date(), method: rzpPayment.method },
      })
    }
  }

  private async onPaymentFailed(rzpPayment: any) {
    const p = await this.prisma.payment.findFirst({
      where: { razorpayOrderId: rzpPayment.order_id },
    })
    if (p) {
      await this.prisma.payment.update({
        where: { id: p.id },
        data:  { status: 'failed' },
      })
    }
  }

  private async onSubscriptionCharged(subscription: any, rzpPayment: any) {
    // Auto-pay mandate charged — find and update the payment record
    const bookingId = subscription?.notes?.bookingId
    if (!bookingId) return

    const payment = await this.prisma.payment.findFirst({
      where: { bookingId, status: 'pending', type: 'rent' },
      orderBy: { dueDate: 'asc' },
    })
    if (payment) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'success', paidAt: new Date(),
          razorpayPaymentId: rzpPayment.id,
          method: 'upi',
        },
      })
      await this.scheduleNextRent(payment)
    }
  }

  private async onPayoutProcessed(payout: any) {
    if (!payout?.id) return
    await this.prisma.payout.updateMany({
      where: { razorpayPayoutId: payout.id },
      data:  { status: 'completed', processedAt: new Date() },
    })
  }

  private async onPayoutFailed(payout: any) {
    if (!payout?.id) return
    await this.prisma.payout.updateMany({
      where: { razorpayPayoutId: payout.id },
      data:  { status: 'failed', failureReason: payout.failure_reason },
    })
  }
}
