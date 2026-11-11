import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus, Headers, RawBodyRequest, Req,
} from '@nestjs/common'
import { Request } from 'express'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { PaymentsService } from './payments.service'
import { RolesGuard }      from '../auth/guards/index'
import { CurrentUser, Roles, Public } from '../../common/decorators/index'
import {
  CreateOrderDto, VerifyPaymentDto, UPICollectDto,
  SetupAutoPayDto, ManualPayoutDto, RefundDto,
} from './dto/payments.dto'
import { User } from '@prisma/client'

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly svc: PaymentsService) {}

  // ─── TENANT ──────────────────────────────────────────────────────────────────

  @Get('due')
  @Roles('tenant')
  @ApiOperation({ summary: 'Tenant — get all pending/overdue payments' })
  getDue(@CurrentUser() user: User) {
    return this.svc.getTenantDuePayments(user.id)
  }

  @Post('order')
  @Roles('tenant')
  @ApiOperation({
    summary: 'Tenant — create Razorpay order for a payment',
    description: `
      Supports all payment methods:
      - upi → Razorpay checkout (QR / UPI apps)
      - upi_direct → Send collect request to tenant's UPI ID (no checkout page)
      - card → Card payment via Razorpay checkout
      - net_banking → Net banking via Razorpay checkout
      - wallet → Wallets (Paytm, etc.) via Razorpay checkout
    `,
  })
  createOrder(@CurrentUser() user: User, @Body() dto: CreateOrderDto) {
    return this.svc.createOrder(user.id, dto)
  }

  @Post('verify')
  @Roles('tenant')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Tenant — verify payment after Razorpay checkout',
    description: 'Must be called after Razorpay checkout succeeds. Validates signature, generates receipt, triggers owner payout.',
  })
  verifyPayment(@CurrentUser() user: User, @Body() dto: VerifyPaymentDto) {
    return this.svc.verifyPayment(user.id, dto)
  }

  @Post('auto-pay/setup')
  @Roles('tenant')
  @ApiOperation({
    summary: 'Tenant — setup auto-pay mandate for monthly rent',
    description: 'Creates Razorpay UPI Autopay / card mandate. Tenant authorises once — rent deducted automatically every month.',
  })
  setupAutoPay(@CurrentUser() user: User, @Body() dto: SetupAutoPayDto) {
    return this.svc.setupAutoPay(user.id, dto)
  }

  @Get('history')
  @Roles('tenant')
  @ApiOperation({ summary: 'Tenant — payment history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  tenantHistory(
    @CurrentUser() user: User,
    @Query('page') page?: string,
  ) {
    return this.svc.getHistory(user.id, 'tenant', Number(page ?? 1))
  }

  // ─── OWNER ───────────────────────────────────────────────────────────────────

  @Get('earnings')
  @Roles('owner')
  @ApiOperation({ summary: 'Owner — earnings summary + recent payouts' })
  earnings(@CurrentUser() user: User) {
    return this.svc.ownerEarnings(user.id)
  }

  @Get('owner/history')
  @Roles('owner')
  @ApiOperation({ summary: 'Owner — received payment history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  ownerHistory(
    @CurrentUser() user: User,
    @Query('page') page?: string,
  ) {
    return this.svc.getHistory(user.id, 'owner', Number(page ?? 1))
  }

  // ─── WEBHOOK (Razorpay → server) ─────────────────────────────────────────────

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Razorpay webhook — payment captured / failed / payout processed',
    description: 'Validates X-Razorpay-Signature header. Handles: payment.captured, payment.failed, subscription.charged, payout.processed, payout.failed',
  })
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
    @Body() payload: any,
  ) {
    const rawBody = req.rawBody?.toString() ?? JSON.stringify(payload)
    return this.svc.handleWebhook(rawBody, signature, payload)
  }

  // ─── ADMIN ───────────────────────────────────────────────────────────────────

  @Get('admin/overview')
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] Platform payment overview — revenue, overdue, failed counts' })
  adminOverview() {
    return this.svc.adminOverview()
  }

  @Post('admin/payout')
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] Manually trigger owner payout for a payment' })
  adminPayout(@CurrentUser() admin: User, @Body() dto: ManualPayoutDto) {
    return this.svc.adminManualPayout(admin.id, dto)
  }

  @Post('admin/refund')
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] Issue full or partial refund to tenant' })
  adminRefund(@CurrentUser() admin: User, @Body() dto: RefundDto) {
    return this.svc.adminRefund(admin.id, dto)
  }
}
