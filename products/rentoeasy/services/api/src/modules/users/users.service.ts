import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { UploadService } from '../../config/upload.service'
import {
  UpdateTenantProfileDto,
  UpdateOwnerProfileDto,
  UpdateFCMTokenDto,
  UpdateDeviceDto,
} from './dto/users.dto'
import { User, UserRole } from '@prisma/client'

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(
    private prisma: PrismaService,
    private upload: UploadService,
  ) {}

  // ─── GET PROFILE ─────────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        kycDocuments: {
          select: { type: true, status: true, updatedAt: true },
        },
      },
    })
    if (!user) throw new NotFoundException('User not found')
    return this.sanitize(user)
  }

  // ─── GET PUBLIC PROFILE (for owner viewing tenant before accepting booking) ───

  async getPublicProfile(viewerId: string, targetUserId: string) {
    const viewer = await this.prisma.user.findUnique({ where: { id: viewerId } })
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        kycDocuments: { select: { type: true, status: true } },
      },
    })

    if (!target || !target.isActive) throw new NotFoundException('User not found')

    // Owner can view tenant public profile only if there's a booking between them
    if (viewer?.role === 'owner' && target.role === 'tenant') {
      const hasBooking = await this.prisma.booking.findFirst({
        where: { tenantId: targetUserId, ownerId: viewerId },
      })
      if (!hasBooking) throw new ForbiddenException('Access denied')
    }

    // Return limited public fields only
    return {
      id:           target.id,
      name:         target.name,
      profilePhoto: target.profilePhoto,
      city:         target.city,
      kycStatus:    target.kycStatus,
      memberSince:  target.createdAt,
      verifiedDocs: (target.kycDocuments ?? [])
        .filter((d) => d.status === 'verified')
        .map((d) => d.type),
    }
  }

  // ─── UPDATE TENANT PROFILE ────────────────────────────────────────────────────

  async updateTenantProfile(userId: string, dto: UpdateTenantProfileDto) {
    await this.findActiveUser(userId, 'tenant')

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name             && { name: dto.name.trim() }),
        ...(dto.email            && { email: dto.email.toLowerCase().trim() }),
        ...(dto.permanentAddress && { permanentAddress: dto.permanentAddress.trim() }),
        ...(dto.city             && { city: dto.city.trim() }),
        ...(dto.declaredIdType   && { declaredIdType: dto.declaredIdType }),
        ...(dto.declaredIdLastFour && { declaredIdLastFour: dto.declaredIdLastFour }),
      },
    })

    this.logger.log(`Tenant profile updated: ${userId}`)
    return this.sanitize(updated)
  }

  // ─── UPDATE OWNER PROFILE ─────────────────────────────────────────────────────

  async updateOwnerProfile(userId: string, dto: UpdateOwnerProfileDto) {
    await this.findActiveUser(userId, 'owner')

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name      && { name: dto.name.trim() }),
        ...(dto.email     && { email: dto.email.toLowerCase().trim() }),
        ...(dto.panNumber && { panNumber: dto.panNumber.toUpperCase().trim() }),
      },
    })

    return this.sanitize(updated)
  }

  // ─── UPLOAD PROFILE PHOTO ─────────────────────────────────────────────────────

  async uploadProfilePhoto(
    userId: string,
    fileBuffer: Buffer,
    mimeType: string,
  ) {
    const user = await this.findActiveUser(userId)

    // Delete old photo from Cloudinary if exists
    if (user.profilePhoto) {
      const oldPublicId = this.extractCloudinaryPublicId(user.profilePhoto)
      if (oldPublicId) await this.upload.deleteImage(oldPublicId)
    }

    const { url } = await this.upload.uploadImage(fileBuffer, mimeType, 'profiles', {
      width: 400, height: 400,
    })

    await this.prisma.user.update({
      where: { id: userId },
      data: { profilePhoto: url },
    })

    return { profilePhoto: url }
  }

  // ─── UPDATE FCM TOKEN ─────────────────────────────────────────────────────────

  async updateFCMToken(userId: string, dto: UpdateFCMTokenDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken: dto.fcmToken },
    })
    return { message: 'Push notification token updated' }
  }

  // ─── UPDATE DEVICE INFO ───────────────────────────────────────────────────────

  async updateDevice(userId: string, dto: UpdateDeviceDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.deviceId && { deviceId: dto.deviceId }),
        ...(dto.fcmToken && { fcmToken: dto.fcmToken }),
      },
    })
    return { message: 'Device info updated' }
  }

  // ─── DEACTIVATE OWN ACCOUNT ───────────────────────────────────────────────────

  async deactivateAccount(userId: string) {
    // Check no active bookings
    const activeBooking = await this.prisma.booking.findFirst({
      where: {
        OR: [{ tenantId: userId }, { ownerId: userId }],
        status: { in: ['pending', 'accepted', 'active'] },
      },
    })
    if (activeBooking) {
      throw new BadRequestException(
        'You have active bookings. Please complete or cancel them before deactivating.',
      )
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    })

    // Revoke all tokens
    await this.prisma.refreshToken.deleteMany({ where: { userId } })

    this.logger.log(`Account deactivated: ${userId}`)
    return { message: 'Account deactivated successfully' }
  }

  // ─── ADMIN — GET ALL USERS ────────────────────────────────────────────────────

  async adminGetUsers(query: {
    role?: UserRole
    kycStatus?: string
    isActive?: boolean
    search?: string
    page?: number
    limit?: number
  }) {
    const page  = query.page  ?? 1
    const limit = Math.min(query.limit ?? 20, 100)
    const skip  = (page - 1) * limit

    const where: any = {}
    if (query.role)      where.role      = query.role
    if (query.kycStatus) where.kycStatus = query.kycStatus
    if (query.isActive !== undefined) where.isActive = query.isActive
    if (query.search) {
      where.OR = [
        { name:  { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ]
    }

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { kycDocuments: { select: { type: true, status: true } } },
      }),
      this.prisma.user.count({ where }),
    ])

    return {
      data: users.map((u) => this.sanitize(u)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  // ─── ADMIN — SUSPEND / UNSUSPEND USER ────────────────────────────────────────

  async adminToggleUserStatus(
    adminId: string,
    targetUserId: string,
    isActive: boolean,
    reason?: string,
  ) {
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } })
    if (!target) throw new NotFoundException('User not found')
    if (target.role === 'admin') throw new ForbiddenException('Cannot suspend admin accounts')

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { isActive },
    })

    // Revoke all tokens if suspending
    if (!isActive) {
      await this.prisma.refreshToken.deleteMany({ where: { userId: targetUserId } })
    }

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        actorId:    adminId,
        actorRole:  'admin',
        action:     isActive ? 'USER_UNSUSPENDED' : 'USER_SUSPENDED',
        targetType: 'User',
        targetId:   targetUserId,
        metadata:   { reason },
      },
    })

    return {
      message: `User ${isActive ? 'reactivated' : 'suspended'} successfully`,
      userId:  targetUserId,
      isActive,
    }
  }

  // ─── ADMIN — GET USER DETAIL ──────────────────────────────────────────────────

  async adminGetUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        kycDocuments: true,
        tenantBookings: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { property: { select: { title: true, city: true } } },
        },
        ownerBookings: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        ownedProperties: {
          take: 5,
          select: { id: true, title: true, status: true, monthlyRent: true },
        },
      },
    })
    if (!user) throw new NotFoundException('User not found')
    return user
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────────

  private async findActiveUser(userId: string, role?: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')
    if (!user.isActive) throw new ForbiddenException('Account is suspended')
    if (role && user.role !== role && user.role !== 'admin') {
      throw new ForbiddenException(`This action is for ${role}s only`)
    }
    return user
  }

  private extractCloudinaryPublicId(url: string): string | null {
    // Extract public_id from Cloudinary URL
    // e.g. https://res.cloudinary.com/xxx/image/upload/v123/rent-stay/profiles/uuid.webp
    const match = url.match(/\/rent-stay\/.+?(?=\.\w+$)/)
    return match ? `rent-stay${match[0].split('/rent-stay')[1]}` : null
  }

  private sanitize(user: any) {
    // Never send sensitive fields to client
    const { bankAccountNumber, bankIfsc, fcmToken, deviceId, ...safe } = user
    return {
      ...safe,
      // Mask bank account if present
      ...(bankAccountNumber && { bankAccountMasked: `XXXX${bankAccountNumber.slice(-4)}` }),
    }
  }
}
