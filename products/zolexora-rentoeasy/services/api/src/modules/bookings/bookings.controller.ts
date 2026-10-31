import {
  Controller, Get, Post, Patch, Body, Param,
  Query, UseGuards, HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { BookingsService } from './bookings.service'
import { RolesGuard }      from '../auth/guards/index'
import { CurrentUser, Roles, Public } from '../../common/decorators/index'
import {
  CreateBookingDto, RespondBookingDto, CancelBookingDto,
  UpdatePoliceVerificationDto, AdminBookingQueryDto,
} from './dto/bookings.dto'
import { User } from '@prisma/client'

@ApiTags('bookings')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly svc: BookingsService) {}

  // ─── TENANT ──────────────────────────────────────────────────────────────────

  @Post()
  @Roles('tenant')
  @ApiOperation({
    summary: 'Tenant — request a booking',
    description: 'Tenant must have Aadhaar verified. Property must be active. Creates pending booking.',
  })
  create(@CurrentUser() user: User, @Body() dto: CreateBookingDto) {
    return this.svc.create(user.id, dto)
  }

  @Get('tenant/my-bookings')
  @Roles('tenant')
  @ApiOperation({ summary: 'Tenant — list my bookings' })
  @ApiQuery({ name: 'status', required: false,
    enum: ['pending','accepted','rejected','active','cancelled','completed'] })
  @ApiQuery({ name: 'page',  required: false, type: Number })
  tenantBookings(
    @CurrentUser() user: User,
    @Query('status') status?: string,
    @Query('page') page?: string,
  ) {
    return this.svc.tenantBookings(user.id, status, Number(page ?? 1))
  }

  // ─── OWNER ───────────────────────────────────────────────────────────────────

  @Get('owner/my-bookings')
  @Roles('owner')
  @ApiOperation({ summary: 'Owner — list all bookings for my properties' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page',   required: false, type: Number })
  ownerBookings(
    @CurrentUser() user: User,
    @Query('status') status?: string,
    @Query('page') page?: string,
  ) {
    return this.svc.ownerBookings(user.id, status, Number(page ?? 1))
  }

  @Patch(':id/respond')
  @Roles('owner')
  @ApiOperation({
    summary: 'Owner — accept or reject a booking request',
    description: 'Accepting triggers agreement generation + Digio eSign request. Chat room created automatically.',
  })
  respond(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondBookingDto,
  ) {
    return this.svc.respond(user.id, id, dto)
  }

  @Get(':id/police-verification')
  @Roles('owner')
  @ApiOperation({
    summary: 'Owner — get pre-filled police verification form data',
    description: 'Returns all tenant + property data pre-filled. Includes state portal URL. Owner just submits.',
  })
  getPoliceForm(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getPoliceVerificationData(user.id, id)
  }

  @Patch(':id/police-verification')
  @Roles('owner')
  @ApiOperation({ summary: 'Owner — mark police verification status (submitted / verified)' })
  updatePoliceVerification(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePoliceVerificationDto,
  ) {
    return this.svc.updatePoliceVerification(user.id, id, dto)
  }

  // ─── SHARED ──────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get full booking detail — accessible by tenant or owner' })
  findOne(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findOne(user.id, id)
  }

  @Get(':id/signing-url')
  @ApiOperation({
    summary: 'Get your personal agreement signing URL',
    description: 'Returns the Digio signing URL for the current user (owner or tenant). Open in WebView / browser.',
  })
  getSigningUrl(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getSigningUrl(user.id, id)
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a booking — allowed for tenant or owner on pending/accepted bookings' })
  cancel(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.svc.cancel(user.id, id, dto)
  }

  @Post(':id/agreement/generate')
  @Roles('owner')
  @ApiOperation({
    summary: 'Manually re-generate agreement (if auto-generation failed on accept)',
    description: 'Idempotent — safe to call multiple times. Sends new Digio eSign request.',
  })
  generateAgreement(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.generateAgreement(id)
  }

  // ─── WEBHOOK ─────────────────────────────────────────────────────────────────

  @Public()
  @Post('webhook/agreement-signed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Digio webhook — agreement fully signed by both parties' })
  agreementWebhook(@Body() payload: any) {
    return this.svc.handleAgreementWebhook(payload)
  }

  // ─── ADMIN ───────────────────────────────────────────────────────────────────

  @Get('admin/all')
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] List all bookings with filters' })
  adminList(@Query() dto: AdminBookingQueryDto) {
    return this.svc.adminList(dto)
  }
}
