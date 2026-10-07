import { Injectable, Logger }  from '@nestjs/common'
import {
  Controller, Get, Patch, Post, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common'
import { Module }         from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { IsNumber, Min, Max, IsOptional, IsString } from 'class-validator'
import { Type }           from 'class-transformer'
import { PrismaService }  from '../../prisma/prisma.service'
import { RolesGuard }     from '../auth/guards/index'
import { CurrentUser, Roles } from '../../common/decorators/index'
import { User }           from '@prisma/client'

// ─── DTO ─────────────────────────────────────────────────────────────────────

class UpdatePlatformConfigDto {
  @IsOptional() @IsNumber() @Min(0) @Max(10) @Type(() => Number)
  platformFeePercent?: number

  @IsOptional() @IsNumber() @Min(1) @Max(28) @Type(() => Number)
  rentDueDayOfMonth?: number

  @IsOptional() @IsNumber() @Min(60) @Max(600) @Type(() => Number)
  otpExpirySeconds?: number
}

// ─── SERVICE ──────────────────────────────────────────────────────────────────

@Injectable()
class AdminService {
  private readonly logger = new Logger(AdminService.name)

  constructor(private prisma: PrismaService) {}

  // ─── PLATFORM DASHBOARD ────────────────────────────────────────────────────

  async getDashboard() {
    const now        = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      totalUsers, newUsersThisMonth,
      totalProperties, activeProperties,
      totalBookings, activeBookings,
      totalRevenue, monthlyRevenue,
      pendingKYC, pendingListings,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
      this.prisma.property.count(),
      this.prisma.property.count({ where: { status: 'active' } }),
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { status: 'active' } }),
      this.prisma.payment.aggregate({ where: { status: 'success' }, _sum: { platformFeePaise: true } }),
      this.prisma.payment.aggregate({ where: { status: 'success', paidAt: { gte: monthStart } }, _sum: { platformFeePaise: true } }),
      this.prisma.kYCDocument.count({ where: { status: 'submitted' } }),
      this.prisma.property.count({ where: { status: 'under_review' } }),
    ])

    // User breakdown
    const [tenants, owners] = await Promise.all([
      this.prisma.user.count({ where: { role: 'tenant' } }),
      this.prisma.user.count({ where: { role: 'owner' } }),
    ])

    // Revenue trend — last 6 months
    const trend = await Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
        return this.prisma.payment.aggregate({
          where: { status: 'success', paidAt: { gte: start, lt: end } },
          _sum:  { amountPaise: true },
        }).then((r) => ({
          month:        start.toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
          revenueRupees: (r._sum.amountPaise ?? 0) / 100,
        }))
      }),
    )

    return {
      users:       { total: totalUsers, tenants, owners, newThisMonth: newUsersThisMonth },
      properties:  { total: totalProperties, active: activeProperties, pendingReview: pendingListings },
      bookings:    { total: totalBookings, active: activeBookings },
      revenue: {
        totalPlatformFeeRupees:  (totalRevenue._sum.platformFeePaise ?? 0) / 100,
        thisMonthFeeRupees:      (monthlyRevenue._sum.platformFeePaise ?? 0) / 100,
      },
      pending:     { kyc: pendingKYC, listings: pendingListings },
      revenueTrend: trend.reverse(),
    }
  }

  // ─── CITY BREAKDOWN ────────────────────────────────────────────────────────

  async getCityStats() {
    const cities = await this.prisma.property.groupBy({
      by:       ['city'],
      _count:   { id: true },
      orderBy:  { _count: { id: 'desc' } },
      take:     10,
    })
    return cities.map((c) => ({ city: c.city, listings: c._count.id }))
  }

  // ─── AUDIT LOGS ────────────────────────────────────────────────────────────

  async getAuditLogs(page = 1, limit = 50, actorId?: string) {
    const skip  = (page - 1) * limit
    const where: any = {}
    if (actorId) where.actorId = actorId

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.auditLog.count({ where }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  // ─── PLATFORM CONFIG ───────────────────────────────────────────────────────

  async getConfig() {
    return this.prisma.platformConfig.upsert({
      where:  { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    })
  }

  async updateConfig(adminId: string, dto: UpdatePlatformConfigDto) {
    const config = await this.prisma.platformConfig.upsert({
      where:  { id: 'singleton' },
      create: { id: 'singleton', ...dto },
      update: dto,
    })

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId, actorRole: 'admin',
        action: 'PLATFORM_CONFIG_UPDATED',
        targetType: 'PlatformConfig', targetId: 'singleton',
        metadata: dto as any,
      },
    })

    return config
  }

  // ─── PENDING PAYOUT QUEUE ──────────────────────────────────────────────────

  async getPayoutQueue(page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const [data, total] = await this.prisma.$transaction([
      this.prisma.payout.findMany({
        where: { status: { in: ['pending', 'failed'] } },
        skip, take: limit, orderBy: { createdAt: 'asc' },
        include: {
          owner:   { select: { name: true, phone: true, bankAccountName: true } },
          payment: { select: { amountPaise: true, receiptNumber: true, paidAt: true } },
        },
      }),
      this.prisma.payout.count({ where: { status: { in: ['pending', 'failed'] } } }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }
}

// ─── CONTROLLER ──────────────────────────────────────────────────────────────

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('admin')
@Controller('admin')
class AdminController {
  constructor(private readonly svc: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: '[Admin] Platform dashboard — users, revenue, bookings, pending actions' })
  dashboard() { return this.svc.getDashboard() }

  @Get('city-stats')
  @ApiOperation({ summary: '[Admin] Top cities by listing count' })
  cityStats() { return this.svc.getCityStats() }

  @Get('audit-logs')
  @ApiOperation({ summary: '[Admin] Audit log trail' })
  auditLogs(
    @Query('page') page?: string,
    @Query('actorId') actorId?: string,
  ) {
    return this.svc.getAuditLogs(Number(page ?? 1), 50, actorId)
  }

  @Get('config')
  @ApiOperation({ summary: '[Admin] Get platform config (fee %, OTP expiry, rent due day)' })
  getConfig() { return this.svc.getConfig() }

  @Patch('config')
  @ApiOperation({ summary: '[Admin] Update platform config' })
  updateConfig(@CurrentUser() admin: User, @Body() dto: UpdatePlatformConfigDto) {
    return this.svc.updateConfig(admin.id, dto)
  }

  @Get('payout-queue')
  @ApiOperation({ summary: '[Admin] Pending + failed payout queue' })
  payoutQueue(@Query('page') page?: string) {
    return this.svc.getPayoutQueue(Number(page ?? 1))
  }
}

// ─── MODULE ───────────────────────────────────────────────────────────────────

@Module({
  controllers: [AdminController],
  providers:   [AdminService],
  exports:     [AdminService],
})
export class AdminModule {}
