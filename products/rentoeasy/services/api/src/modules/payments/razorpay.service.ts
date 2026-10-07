import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Razorpay from 'razorpay'
import * as crypto from 'crypto'

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name)
  private readonly rzp: Razorpay

  constructor(private config: ConfigService) {
    this.rzp = new Razorpay({
      key_id:     config.get('RAZORPAY_KEY_ID')!,
      key_secret: config.get('RAZORPAY_KEY_SECRET')!,
    })
  }

  // ─── CREATE ORDER (card / net_banking / wallet / upi via checkout) ────────────

  async createOrder(params: {
    amountPaise:  number
    currency?:    string
    receiptId:    string
    bookingId:    string
    paymentId:    string
    tenantPhone:  string
    tenantEmail?: string
  }) {
    try {
      const order = await this.rzp.orders.create({
        amount:   params.amountPaise,
        currency: params.currency ?? 'INR',
        receipt:  params.receiptId,
        notes: {
          bookingId: params.bookingId,
          paymentId: params.paymentId,
        },
      })
      this.logger.log(`Razorpay order created: ${order.id}`)
      return {
        orderId:     order.id,
        amount:      order.amount,
        currency:    order.currency,
        keyId:       this.config.get('RAZORPAY_KEY_ID'),
        tenantPhone: params.tenantPhone,
        tenantEmail: params.tenantEmail,
      }
    } catch (err: any) {
      this.logger.error(`Order creation failed: ${err?.error?.description ?? err?.message}`)
      throw new BadRequestException('Payment initiation failed. Please try again.')
    }
  }

  // ─── UPI COLLECT REQUEST (direct UPI ID) ──────────────────────────────────────
  // Sends a collect request directly to tenant's UPI ID (e.g. rahul@okicici).
  // Tenant sees notification in their UPI app and approves.
  // No Razorpay checkout page needed.

  async createUPICollect(params: {
    amountPaise:  number
    receiptId:    string
    bookingId:    string
    paymentId:    string
    upiId:        string
    tenantName:   string
    description?: string
  }) {
    try {
      // Step 1 — create order
      const order = await this.rzp.orders.create({
        amount:   params.amountPaise,
        currency: 'INR',
        receipt:  params.receiptId,
        notes: {
          bookingId: params.bookingId,
          paymentId: params.paymentId,
          upi_id:    params.upiId,
        },
        method: 'upi' as any,
      })

      // Step 2 — create UPI payment with vpa (virtual payment address)
      const payment = await (this.rzp as any).payments.createUpi({
        amount:      params.amountPaise,
        currency:    'INR',
        order_id:    order.id,
        method:      'upi',
        vpa:         params.upiId,
        description: params.description ?? 'Rent payment via Rent & Stay',
        customer: { name: params.tenantName },
      })

      this.logger.log(`UPI collect sent to ${params.upiId}: ${payment.id}`)

      return {
        orderId:   order.id,
        paymentId: payment.id,
        upiId:     params.upiId,
        status:    payment.status,  // 'created' — tenant must approve in UPI app
        message:   `Collect request sent to ${params.upiId}. Approve in your UPI app.`,
      }
    } catch (err: any) {
      const desc = err?.error?.description ?? err?.message ?? 'Unknown error'
      this.logger.error(`UPI collect failed: ${desc}`)

      // Friendly error for invalid UPI ID
      if (desc.toLowerCase().includes('vpa') || desc.toLowerCase().includes('invalid')) {
        throw new BadRequestException(`Invalid UPI ID: ${params.upiId}. Please check and try again.`)
      }
      throw new BadRequestException('UPI collect request failed. Please try again.')
    }
  }

  // ─── VERIFY PAYMENT SIGNATURE ─────────────────────────────────────────────────
  // Must be called after Razorpay checkout returns to verify payment is genuine.

  verifySignature(params: {
    orderId:    string
    paymentId:  string
    signature:  string
  }): boolean {
    const body    = `${params.orderId}|${params.paymentId}`
    const secret  = this.config.get('RAZORPAY_KEY_SECRET')!
    const expected = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex')

    return expected === params.signature
  }

  // ─── VERIFY WEBHOOK SIGNATURE ────────────────────────────────────────────────

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const secret   = this.config.get('RAZORPAY_WEBHOOK_SECRET')!
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')
    return expected === signature
  }

  // ─── FETCH PAYMENT STATUS ────────────────────────────────────────────────────

  async fetchPayment(razorpayPaymentId: string) {
    try {
      return await this.rzp.payments.fetch(razorpayPaymentId)
    } catch (err) {
      this.logger.error(`Fetch payment failed: ${razorpayPaymentId}`)
      return null
    }
  }

  // ─── SETUP RECURRING MANDATE (auto-pay) ──────────────────────────────────────
  // Creates a Razorpay subscription or UPI Autopay mandate.
  // Tenant authorises once — rent deducted automatically every month.

  async createMandate(params: {
    bookingId:   string
    tenantPhone: string
    tenantEmail?: string
    tenantName:  string
    monthlyRent: number   // in rupees
    startDate:   Date
    method:      'upi' | 'card' | 'net_banking'
    upiId?:      string
  }) {
    try {
      // Create Razorpay plan (monthly)
      const plan = await (this.rzp as any).plans.create({
        period:   'monthly',
        interval: 1,
        item: {
          name:     `Rent - Booking ${params.bookingId}`,
          amount:   params.monthlyRent * 100, // paise
          currency: 'INR',
        },
        notes: { bookingId: params.bookingId },
      })

      // Create subscription
      const subscription = await (this.rzp as any).subscriptions.create({
        plan_id:         plan.id,
        total_count:     11,  // 11-month agreement
        quantity:        1,
        start_at:        Math.floor(params.startDate.getTime() / 1000),
        customer_notify: 1,
        notes: {
          bookingId:  params.bookingId,
          tenantPhone: params.tenantPhone,
        },
        addons: [],
        ...(params.method === 'upi' && params.upiId && {
          payment_method: {
            upi: { vpa: params.upiId },
          },
        }),
      })

      this.logger.log(`Mandate created: ${subscription.id} for booking ${params.bookingId}`)
      return {
        subscriptionId: subscription.id,
        planId:         plan.id,
        shortUrl:       subscription.short_url,  // share with tenant to authorise
        status:         subscription.status,
      }
    } catch (err: any) {
      this.logger.error(`Mandate creation failed: ${err?.error?.description}`)
      throw new BadRequestException('Auto-pay setup failed. Please try again.')
    }
  }

  // ─── OWNER PAYOUT ────────────────────────────────────────────────────────────
  // Transfers owner's share to their registered bank account via Razorpay X.

  async initiateOwnerPayout(params: {
    ownerAccountNumber: string
    ownerIfsc:          string
    ownerName:          string
    amountPaise:        number
    paymentId:          string
    bookingId:          string
    narration?:         string
  }) {
    try {
      // Step 1 — create/fetch fund account for owner
      const contact = await (this.rzp as any).contacts.create({
        name:         params.ownerName,
        type:         'vendor',
        reference_id: params.paymentId,
      })

      const fundAccount = await (this.rzp as any).fundAccounts.create({
        contact_id:   contact.id,
        account_type: 'bank_account',
        bank_account: {
          name:           params.ownerName,
          ifsc:           params.ownerIfsc,
          account_number: params.ownerAccountNumber,
        },
      })

      // Step 2 — initiate payout
      const payout = await (this.rzp as any).payouts.create({
        account_number: this.config.get('RAZORPAY_X_ACCOUNT_NUMBER'), // your Razorpay X account
        fund_account_id: fundAccount.id,
        amount:          params.amountPaise,
        currency:        'INR',
        mode:            'IMPS',  // instant transfer
        purpose:         'payout',
        queue_if_low_balance: true,
        narration:       params.narration ?? `Rent payout - ${params.paymentId}`,
        notes: {
          paymentId: params.paymentId,
          bookingId: params.bookingId,
        },
      })

      this.logger.log(`Payout initiated: ${payout.id} — ₹${params.amountPaise / 100}`)
      return {
        payoutId:  payout.id,
        status:    payout.status,
        utr:       payout.utr,
        amount:    payout.amount,
      }
    } catch (err: any) {
      this.logger.error(`Payout failed: ${err?.error?.description ?? err?.message}`)
      throw new BadRequestException('Payout initiation failed. Will retry automatically.')
    }
  }

  // ─── REFUND ───────────────────────────────────────────────────────────────────

  async refund(razorpayPaymentId: string, amountPaise?: number, notes?: Record<string, string>) {
    try {
      const refund = await this.rzp.payments.refund(razorpayPaymentId, {
        amount: amountPaise, // undefined = full refund
        notes,
        speed: 'normal',
      } as any)
      this.logger.log(`Refund initiated: ${refund.id} for payment ${razorpayPaymentId}`)
      return refund
    } catch (err: any) {
      this.logger.error(`Refund failed: ${err?.error?.description}`)
      throw new BadRequestException('Refund failed. Please try again.')
    }
  }
}
