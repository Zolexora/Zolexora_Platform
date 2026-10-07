import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue }        from '@nestjs/bull'
import { Queue }              from 'bull'
import { ConfigService }      from '@nestjs/config'
import { PrismaService }      from '../../prisma/prisma.service'
import { MSG91Service }       from '../../config/msg91.service'
import * as admin             from 'firebase-admin'
import sgMail                 from '@sendgrid/mail'
import { Controller, Get, Patch, Param, Query, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { RolesGuard }  from '../auth/guards/index'
import { CurrentUser } from '../../common/decorators/index'
import { User }        from '@prisma/client'

export type NotifType =
  | 'booking_request' | 'booking_accepted' | 'booking_rejected'
  | 'rent_due'        | 'rent_paid'
  | 'maintenance_update' | 'agreement_ready'
  | 'kyc_verified'    | 'kyc_rejected' | 'payout_done'

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)
  private fbApp: admin.app.App | null = null

  constructor(
    @InjectQueue('notifications') private queue: Queue,
    private prisma:  PrismaService,
    private config:  ConfigService,
    private msg91:   MSG91Service,
  ) {
    // Init Firebase Admin
    try {
      this.fbApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId:   config.get('FIREBASE_PROJECT_ID'),
          clientEmail: config.get('FIREBASE_CLIENT_EMAIL'),
          privateKey:  config.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
        }),
      })
    } catch { /* already initialised */ }

    // Init SendGrid
    sgMail.setApiKey(config.get('SENDGRID_API_KEY') ?? '')
  }

  // ─── QUEUE NOTIFICATION (non-blocking) ───────────────────────────────────────

  async send(userId: string, type: NotifType, payload: Record<string, string> = {}) {
    await this.queue.add('send', { userId, type, payload }, {
      attempts:  3,
      backoff:   { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
    })
  }

  // ─── PROCESS QUEUED NOTIFICATION ────────────────────────────────────────────

  async processNotification(userId: string, type: NotifType, payload: Record<string, string>) {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { fcmToken: true, phone: true, email: true, name: true },
    })
    if (!user) return

    const template = this.getTemplate(type, payload)

    // 1. Save to DB
    await this.prisma.notification.create({
      data: { userId, type, title: template.title, body: template.body, data: payload },
    })

    // 2. Push notification (FCM)
    if (user.fcmToken) {
      await this.sendPush(user.fcmToken, template.title, template.body, payload)
    }

    // 3. SMS for high-priority events
    if (['rent_due', 'rent_paid', 'booking_accepted', 'payout_done'].includes(type)) {
      await this.msg91.sendSMS(user.phone, `${template.title}: ${template.body}`)
    }

    // 4. Email for receipts / agreements
    if (user.email && ['rent_paid', 'agreement_ready'].includes(type)) {
      await this.sendEmail(user.email, user.name, template.title, template.body, payload)
    }
  }

  // ─── SEND FCM PUSH ────────────────────────────────────────────────────────────

  private async sendPush(fcmToken: string, title: string, body: string, data: Record<string, string>) {
    if (!this.fbApp) return
    try {
      await admin.messaging(this.fbApp).send({
        token: fcmToken,
        notification: { title, body },
        data,
        android: { priority: 'high', notification: { sound: 'default' } },
        apns:    { payload: { aps: { sound: 'default', badge: 1 } } },
      })
    } catch (err: any) {
      this.logger.warn(`FCM push failed: ${err?.message}`)
      // Token invalid — clear it
      if (err?.code === 'messaging/registration-token-not-registered') {
        await this.prisma.user.updateMany({
          where: { fcmToken }, data: { fcmToken: null },
        })
      }
    }
  }

  // ─── SEND EMAIL ───────────────────────────────────────────────────────────────

  private async sendEmail(to: string, name: string, subject: string, body: string, payload: Record<string, string>) {
    try {
      await sgMail.send({
        to,
        from: { email: this.config.get('SENDGRID_FROM_EMAIL') ?? 'noreply@rentandstay.in', name: 'Rent & Stay' },
        subject,
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px">
            <h2 style="color:#0F6E56">Rent & Stay</h2>
            <p>Hi ${name},</p>
            <p>${body}</p>
            ${payload.receipt_url ? `<p><a href="${payload.receipt_url}" style="background:#0F6E56;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Download Receipt</a></p>` : ''}
            ${payload.signing_url ? `<p><a href="${payload.signing_url}" style="background:#0F6E56;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Sign Agreement</a></p>` : ''}
            <hr style="margin:20px 0;border:none;border-top:1px solid #eee">
            <p style="font-size:12px;color:#aaa">Rent & Stay · www.rentandstay.in · support@rentandstay.in</p>
          </div>`,
      })
    } catch (err: any) {
      this.logger.warn(`SendGrid failed: ${err?.message}`)
    }
  }

  // ─── NOTIFICATION TEMPLATES ───────────────────────────────────────────────────

  private getTemplate(type: NotifType, p: Record<string, string>): { title: string; body: string } {
    const templates: Record<NotifType, { title: string; body: string }> = {
      booking_request:    { title: 'New Booking Request',    body: `${p.tenantName ?? 'A tenant'} has requested to book your property.` },
      booking_accepted:   { title: 'Booking Accepted! 🎉',   body: `Your booking for ${p.propertyTitle ?? 'the property'} has been accepted. Please sign the agreement.` },
      booking_rejected:   { title: 'Booking Not Available',  body: `Your booking request for ${p.propertyTitle ?? 'the property'} was not accepted. ${p.reason ?? ''}` },
      rent_due:           { title: 'Rent Due 📅',            body: `₹${p.amount ?? ''} rent is due on ${p.dueDate ?? 'the 1st'}. Pay now to avoid late fees.` },
      rent_paid:          { title: 'Rent Paid ✅',           body: `₹${p.amount ?? ''} received for ${p.period ?? 'this month'}. Receipt attached.` },
      maintenance_update: { title: 'Maintenance Update',     body: `Your request "${p.title ?? ''}" status: ${p.status ?? 'updated'}.` },
      agreement_ready:    { title: 'Agreement Ready to Sign',body: `Your rent agreement for ${p.propertyTitle ?? 'the property'} is ready. Sign now to confirm your booking.` },
      kyc_verified:       { title: 'Verification Complete ✅', body: `Your ${p.docType ?? 'document'} has been verified successfully.` },
      kyc_rejected:       { title: 'Verification Failed',    body: `Your ${p.docType ?? 'document'} verification failed. ${p.reason ?? 'Please re-upload.'}`},
      payout_done:        { title: 'Payout Processed 💰',    body: `₹${p.amount ?? ''} has been transferred to your bank account.` },
    }
    return templates[type] ?? { title: 'Rent & Stay', body: 'You have a new notification.' }
  }

  // ─── GET USER NOTIFICATIONS ───────────────────────────────────────────────────

  async getNotifications(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const [data, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId }, skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit), unreadCount }
  }

  async markRead(userId: string, notifId?: string) {
    if (notifId) {
      await this.prisma.notification.updateMany({
        where: { id: notifId, userId }, data: { readAt: new Date() },
      })
    } else {
      // Mark all as read
      await this.prisma.notification.updateMany({
        where: { userId, readAt: null }, data: { readAt: new Date() },
      })
    }
    return { message: 'Notifications marked as read' }
  }
}

// ─── CONTROLLER ──────────────────────────────────────────────────────────────

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get my notifications (with unread count)' })
  get(@CurrentUser() user: User, @Query('page') page?: string) {
    return this.svc.getNotifications(user.id, Number(page ?? 1))
  }

  @Patch('read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentUser() user: User) {
    return this.svc.markRead(user.id)
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  markOneRead(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.markRead(user.id, id)
  }
}
