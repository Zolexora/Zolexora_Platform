import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger,
} from '@nestjs/common'
import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, ParseUUIDPipe,
} from '@nestjs/common'
import { FileInterceptor }   from '@nestjs/platform-express'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger'
import { IsString, IsOptional, IsEnum, MaxLength, MinLength } from 'class-validator'
import { Module }            from '@nestjs/common'
import { MulterModule }      from '@nestjs/platform-express'
import { memoryStorage }     from 'multer'
import { PrismaService }     from '../../prisma/prisma.service'
import { UploadService }     from '../../config/upload.service'
import { RolesGuard }        from '../auth/guards/index'
import { CurrentUser, Roles } from '../../common/decorators/index'
import { User }              from '@prisma/client'

// ─── DTOs ────────────────────────────────────────────────────────────────────

class CreateMaintenanceDto {
  @IsString() @MinLength(5) @MaxLength(100) title: string
  @IsString() @MinLength(10) @MaxLength(1000) description: string
  @IsOptional() @IsEnum(['low','medium','high','urgent']) priority?: string
  @IsString() bookingId: string
}

class UpdateMaintenanceDto {
  @IsOptional() @IsEnum(['open','in_progress','resolved','closed']) status?: string
  @IsOptional() @IsString() @MaxLength(500) ownerNote?: string
}

// ─── SERVICE ──────────────────────────────────────────────────────────────────

@Injectable()
class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name)

  constructor(
    private prisma:  PrismaService,
    private upload:  UploadService,
  ) {}

  async create(tenantId: string, dto: CreateMaintenanceDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: dto.bookingId, tenantId, status: 'active' },
    })
    if (!booking) throw new NotFoundException('Active booking not found')

    const request = await this.prisma.maintenanceRequest.create({
      data: {
        bookingId:   dto.bookingId,
        propertyId:  booking.propertyId,
        tenantId,
        title:       dto.title,
        description: dto.description,
        priority:    (dto.priority ?? 'medium') as any,
        status:      'open',
      },
      include: this.include(),
    })
    this.logger.log(`Maintenance request ${request.id} created by tenant ${tenantId}`)
    return request
  }

  async addPhoto(tenantId: string, requestId: string, buffer: Buffer, mimeType: string) {
    const req = await this.prisma.maintenanceRequest.findFirst({
      where: { id: requestId, tenantId },
    })
    if (!req) throw new NotFoundException('Request not found')
    if (req.photos.length >= 5) throw new BadRequestException('Max 5 photos per request')

    const { url } = await this.upload.uploadImage(buffer, mimeType, 'maintenance')
    await this.prisma.maintenanceRequest.update({
      where: { id: requestId },
      data:  { photos: { push: url } },
    })
    return { url }
  }

  async updateStatus(ownerId: string, requestId: string, dto: UpdateMaintenanceDto) {
    const req = await this.prisma.maintenanceRequest.findUnique({
      where:   { id: requestId },
      include: { booking: { select: { ownerId: true } } },
    })
    if (!req)                           throw new NotFoundException('Request not found')
    if (req.booking.ownerId !== ownerId) throw new ForbiddenException('Access denied')

    return this.prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        ...(dto.status    && { status:    dto.status as any }),
        ...(dto.ownerNote && { ownerNote: dto.ownerNote }),
        ...(dto.status === 'resolved' && { resolvedAt: new Date() }),
      },
      include: this.include(),
    })
  }

  async tenantList(tenantId: string, bookingId?: string, page = 1, limit = 10) {
    const skip  = (page - 1) * limit
    const where: any = { tenantId }
    if (bookingId) where.bookingId = bookingId
    const [data, total] = await this.prisma.$transaction([
      this.prisma.maintenanceRequest.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: this.include() }),
      this.prisma.maintenanceRequest.count({ where }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async ownerList(ownerId: string, status?: string, page = 1, limit = 10) {
    const skip  = (page - 1) * limit
    const where: any = { booking: { ownerId } }
    if (status) where.status = status
    const [data, total] = await this.prisma.$transaction([
      this.prisma.maintenanceRequest.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: this.include() }),
      this.prisma.maintenanceRequest.count({ where }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(userId: string, requestId: string) {
    const req = await this.prisma.maintenanceRequest.findUnique({
      where: { id: requestId }, include: this.include(),
    })
    if (!req) throw new NotFoundException('Request not found')
    const isParty = req.tenantId === userId || (req as any).booking?.ownerId === userId
    if (!isParty) throw new ForbiddenException('Access denied')
    return req
  }

  private include() {
    return {
      booking: { select: { ownerId: true } },
      tenant:  { select: { id: true, name: true, profilePhoto: true } },
      property: { select: { title: true, addressLine1: true, city: true } },
    }
  }
}

// ─── CONTROLLER ──────────────────────────────────────────────────────────────

@ApiTags('maintenance')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('maintenance')
class MaintenanceController {
  constructor(private readonly svc: MaintenanceService) {}

  @Post()
  @Roles('tenant')
  @ApiOperation({ summary: 'Tenant — submit maintenance request' })
  create(@CurrentUser() user: User, @Body() dto: CreateMaintenanceDto) {
    return this.svc.create(user.id, dto)
  }

  @Post(':id/photos')
  @Roles('tenant')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Tenant — add photo to request (max 5)' })
  addPhoto(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.svc.addPhoto(user.id, id, file.buffer, file.mimetype)
  }

  @Get('tenant/my-requests')
  @Roles('tenant')
  @ApiOperation({ summary: 'Tenant — list my maintenance requests' })
  tenantList(
    @CurrentUser() user: User,
    @Query('bookingId') bookingId?: string,
    @Query('page') page?: string,
  ) {
    return this.svc.tenantList(user.id, bookingId, Number(page ?? 1))
  }

  @Get('owner/requests')
  @Roles('owner')
  @ApiOperation({ summary: 'Owner — list all maintenance requests for my properties' })
  ownerList(
    @CurrentUser() user: User,
    @Query('status') status?: string,
    @Query('page') page?: string,
  ) {
    return this.svc.ownerList(user.id, status, Number(page ?? 1))
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get maintenance request detail' })
  findOne(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(user.id, id)
  }

  @Patch(':id')
  @Roles('owner')
  @ApiOperation({ summary: 'Owner — update request status / add note' })
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMaintenanceDto,
  ) {
    return this.svc.updateStatus(user.id, id, dto)
  }
}

// ─── MODULE ───────────────────────────────────────────────────────────────────

@Module({
  imports: [
    MulterModule.register({ storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }),
  ],
  controllers: [MaintenanceController],
  providers:   [MaintenanceService, UploadService],
  exports:     [MaintenanceService],
})
export class MaintenanceModule {}
