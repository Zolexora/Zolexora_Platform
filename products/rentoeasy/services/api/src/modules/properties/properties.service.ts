import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, Logger,
} from '@nestjs/common'
import { PrismaService }  from '../../prisma/prisma.service'
import { UploadService }  from '../../config/upload.service'
import {
  CreatePropertyDto, UpdatePropertyDto, SearchPropertiesDto,
  UpdateStatusDto, ReorderPhotosDto, AdminPropertyStatusDto,
} from './dto/properties.dto'

@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name)
  private readonly MAX_PHOTOS = 10

  constructor(
    private prisma:  PrismaService,
    private upload:  UploadService,
  ) {}

  // ─── CREATE LISTING ─────────────────────────────────────────────────────────

  async create(ownerId: string, dto: CreatePropertyDto) {
    // Owner must have Aadhaar verified before listing
    const owner = await this.prisma.user.findUnique({
      where:  { id: ownerId },
      select: { aadhaarVerified: true, isActive: true },
    })
    if (!owner?.isActive)        throw new ForbiddenException('Account is suspended')
    if (!owner.aadhaarVerified)  throw new ForbiddenException('Complete Aadhaar verification before listing a property')

    const { amenityIds, ...data } = dto

    const property = await this.prisma.property.create({
      data: {
        ownerId,
        ...data,
        availableFrom: new Date(dto.availableFrom),
        status:        'under_review', // admin reviews before going live
        amenities: amenityIds?.length
          ? { create: amenityIds.map((id) => ({ amenityId: id })) }
          : undefined,
      },
      include: this.fullInclude(),
    })

    this.logger.log(`Property created: ${property.id} by owner ${ownerId}`)
    return property
  }

  // ─── UPDATE LISTING ──────────────────────────────────────────────────────────

  async update(ownerId: string, propertyId: string, dto: UpdatePropertyDto) {
    await this.assertOwnership(ownerId, propertyId)

    const { amenityIds, ...data } = dto

    // If amenities are being updated — replace all
    if (amenityIds !== undefined) {
      await this.prisma.propertyAmenity.deleteMany({ where: { propertyId } })
    }

    const property = await this.prisma.property.update({
      where: { id: propertyId },
      data:  {
        ...data,
        ...(data.availableFrom && { availableFrom: new Date(data.availableFrom) }),
        ...(amenityIds?.length && {
          amenities: { create: amenityIds.map((id) => ({ amenityId: id })) },
        }),
      },
      include: this.fullInclude(),
    })

    return property
  }

  // ─── TOGGLE ACTIVE / INACTIVE ────────────────────────────────────────────────

  async updateStatus(ownerId: string, propertyId: string, dto: UpdateStatusDto) {
    await this.assertOwnership(ownerId, propertyId)

    // Cannot mark active if no photos uploaded
    if (dto.status === 'active') {
      const photoCount = await this.prisma.propertyPhoto.count({ where: { propertyId } })
      if (photoCount === 0) {
        throw new BadRequestException('Upload at least one photo before activating the listing')
      }
    }

    return this.prisma.property.update({
      where: { id: propertyId },
      data:  { status: dto.status },
      include: this.fullInclude(),
    })
  }

  // ─── DELETE LISTING ──────────────────────────────────────────────────────────

  async delete(ownerId: string, propertyId: string) {
    await this.assertOwnership(ownerId, propertyId)

    // Cannot delete with active bookings
    const active = await this.prisma.booking.findFirst({
      where: { propertyId, status: { in: ['pending', 'accepted', 'active'] } },
    })
    if (active) {
      throw new BadRequestException('Cannot delete a property with active or pending bookings')
    }

    // Delete photos from Cloudinary
    const photos = await this.prisma.propertyPhoto.findMany({ where: { propertyId } })
    await Promise.allSettled(photos.map((p) => this.upload.deleteImage(p.url)))

    await this.prisma.property.delete({ where: { id: propertyId } })
    return { message: 'Property deleted successfully' }
  }

  // ─── GET ONE ─────────────────────────────────────────────────────────────────

  async findOne(propertyId: string, viewerId?: string) {
    const property = await this.prisma.property.findUnique({
      where:   { id: propertyId },
      include: {
        ...this.fullInclude(),
        reviews: {
          take:    5,
          orderBy: { createdAt: 'desc' },
          include: { tenant: { select: { name: true, profilePhoto: true } } },
        },
      },
    })

    if (!property) throw new NotFoundException('Property not found')

    // Non-owners can only view active/occupied listings
    if (viewerId !== property.ownerId && !['active', 'occupied'].includes(property.status)) {
      throw new NotFoundException('Property not found')
    }

    return property
  }

  // ─── OWNER — OWN LISTINGS ────────────────────────────────────────────────────

  async ownerListings(ownerId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const [data, total] = await this.prisma.$transaction([
      this.prisma.property.findMany({
        where:   { ownerId },
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: this.fullInclude(),
      }),
      this.prisma.property.count({ where: { ownerId } }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  // ─── PUBLIC SEARCH ───────────────────────────────────────────────────────────

  async search(dto: SearchPropertiesDto) {
    const page  = dto.page  ?? 1
    const limit = dto.limit ?? 20
    const skip  = (page - 1) * limit

    const where: any = { status: 'active' }

    // Text search
    if (dto.q) {
      where.OR = [
        { title:       { contains: dto.q, mode: 'insensitive' } },
        { description: { contains: dto.q, mode: 'insensitive' } },
        { city:        { contains: dto.q, mode: 'insensitive' } },
        { addressLine1:{ contains: dto.q, mode: 'insensitive' } },
      ]
    }

    if (dto.city)            where.city            = { contains: dto.city, mode: 'insensitive' }
    if (dto.pincode)         where.pincode         = dto.pincode
    if (dto.type)            where.type            = dto.type
    if (dto.furnishing)      where.furnishing      = dto.furnishing
    if (dto.genderPreference && dto.genderPreference !== 'any') {
      where.OR = [
        { genderPreference: dto.genderPreference },
        { genderPreference: 'any' },
      ]
    }

    if (dto.minRent || dto.maxRent) {
      where.monthlyRent = {}
      if (dto.minRent) where.monthlyRent.gte = dto.minRent
      if (dto.maxRent) where.monthlyRent.lte = dto.maxRent
    }

    // Geo search — Haversine via raw SQL (Prisma doesn't support geo natively)
    if (dto.lat && dto.lng) {
      const radius = dto.radiusKm ?? 5
      const results = await this.geoSearch(dto.lat, dto.lng, radius, where, skip, limit, dto.sortBy)
      return results
    }

    // Sort
    const orderBy = this.buildOrderBy(dto.sortBy)

    const [data, total] = await this.prisma.$transaction([
      this.prisma.property.findMany({
        where, skip, take: limit, orderBy,
        include: this.listInclude(),
      }),
      this.prisma.property.count({ where }),
    ])

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  // ─── MAP PINS — lightweight for map view ────────────────────────────────────

  async mapPins(lat: number, lng: number, radiusKm = 10) {
    // Returns minimal data — just enough to render pins on map
    const pins = await this.prisma.$queryRaw<any[]>`
      SELECT
        id, title, "monthlyRent", latitude, longitude,
        type, "genderPreference", rating,
        (SELECT url FROM "07_ras_property_photos"
          WHERE "propertyId" = p.id AND "isPrimary" = true LIMIT 1) as "primaryPhoto",
        (6371 * acos(
          cos(radians(${lat})) * cos(radians(latitude)) *
          cos(radians(longitude) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(latitude))
        )) AS distance_km
      FROM "06_ras_properties" p
      WHERE status = 'active'
        AND (6371 * acos(
          cos(radians(${lat})) * cos(radians(latitude)) *
          cos(radians(longitude) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(latitude))
        )) <= ${radiusKm}
      ORDER BY distance_km
      LIMIT 100
    `
    return pins
  }

  // ─── AMENITIES LIST ──────────────────────────────────────────────────────────

  async getAmenities() {
    return this.prisma.amenity.findMany({ orderBy: { sortOrder: 'asc' } })
  }

  // ─── PHOTO MANAGEMENT ───────────────────────────────────────────────────────

  async addPhoto(
    ownerId: string,
    propertyId: string,
    fileBuffer: Buffer,
    mimeType: string,
  ) {
    await this.assertOwnership(ownerId, propertyId)

    const count = await this.prisma.propertyPhoto.count({ where: { propertyId } })
    if (count >= this.MAX_PHOTOS) {
      throw new BadRequestException(`Maximum ${this.MAX_PHOTOS} photos allowed per listing`)
    }

    const { url, thumbnailUrl } = await this.upload.uploadImage(
      fileBuffer, mimeType, 'properties',
    )

    const isPrimary = count === 0 // first photo is primary

    const photo = await this.prisma.propertyPhoto.create({
      data: { propertyId, url, thumbnailUrl, isPrimary, sortOrder: count },
    })

    this.logger.log(`Photo added to property ${propertyId}: ${photo.id}`)
    return photo
  }

  async deletePhoto(ownerId: string, propertyId: string, photoId: string) {
    await this.assertOwnership(ownerId, propertyId)

    const photo = await this.prisma.propertyPhoto.findFirst({
      where: { id: photoId, propertyId },
    })
    if (!photo) throw new NotFoundException('Photo not found')

    await this.upload.deleteImage(photo.url)
    await this.prisma.propertyPhoto.delete({ where: { id: photoId } })

    // If deleted photo was primary — promote next photo
    if (photo.isPrimary) {
      const next = await this.prisma.propertyPhoto.findFirst({
        where: { propertyId }, orderBy: { sortOrder: 'asc' },
      })
      if (next) {
        await this.prisma.propertyPhoto.update({
          where: { id: next.id }, data: { isPrimary: true },
        })
      }
    }

    return { message: 'Photo deleted' }
  }

  async setPrimaryPhoto(ownerId: string, propertyId: string, photoId: string) {
    await this.assertOwnership(ownerId, propertyId)

    // Clear all primary flags
    await this.prisma.propertyPhoto.updateMany({
      where: { propertyId }, data: { isPrimary: false },
    })

    // Set new primary
    await this.prisma.propertyPhoto.update({
      where: { id: photoId }, data: { isPrimary: true },
    })

    return { message: 'Primary photo updated' }
  }

  async reorderPhotos(ownerId: string, propertyId: string, dto: ReorderPhotosDto) {
    await this.assertOwnership(ownerId, propertyId)

    await Promise.all(
      dto.photoIds.map((id, idx) =>
        this.prisma.propertyPhoto.update({
          where: { id },
          data:  { sortOrder: idx },
        }),
      ),
    )
    return { message: 'Photos reordered' }
  }

  // ─── ADMIN ──────────────────────────────────────────────────────────────────

  async adminList(filters: {
    status?: string; city?: string; ownerId?: string
    page?: number; limit?: number
  }) {
    const page  = filters.page  ?? 1
    const limit = filters.limit ?? 20
    const skip  = (page - 1) * limit
    const where: any = {}
    if (filters.status)  where.status  = filters.status
    if (filters.city)    where.city    = { contains: filters.city, mode: 'insensitive' }
    if (filters.ownerId) where.ownerId = filters.ownerId

    const [data, total] = await this.prisma.$transaction([
      this.prisma.property.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { id: true, name: true, phone: true, aadhaarVerified: true } },
          photos: { where: { isPrimary: true }, take: 1 },
        },
      }),
      this.prisma.property.count({ where }),
    ])
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async adminUpdateStatus(
    adminId: string, propertyId: string, dto: AdminPropertyStatusDto,
  ) {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } })
    if (!property) throw new NotFoundException('Property not found')

    await this.prisma.property.update({
      where: { id: propertyId },
      data:  { status: dto.status as any },
    })

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId, actorRole: 'admin',
        action: `PROPERTY_${dto.status.toUpperCase()}`,
        targetType: 'Property', targetId: propertyId,
        metadata: { reason: dto.reason },
      },
    })

    return { message: `Property marked ${dto.status}`, propertyId }
  }

  // ─── PRIVATE ─────────────────────────────────────────────────────────────────

  private async assertOwnership(ownerId: string, propertyId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId }, select: { ownerId: true },
    })
    if (!property)                   throw new NotFoundException('Property not found')
    if (property.ownerId !== ownerId) throw new ForbiddenException('You do not own this property')
    return property
  }

  private async geoSearch(
    lat: number, lng: number, radiusKm: number,
    where: any, skip: number, limit: number, sortBy?: string,
  ) {
    // Build WHERE clause from filters
    const conditions: string[] = [
      `p.status = 'active'`,
      `(6371 * acos(cos(radians(${lat})) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(${lng})) + sin(radians(${lat})) * sin(radians(p.latitude)))) <= ${radiusKm}`,
    ]

    if (where.type)       conditions.push(`p.type = '${where.type}'`)
    if (where.furnishing) conditions.push(`p.furnishing = '${where.furnishing}'`)
    if (where.monthlyRent?.gte) conditions.push(`p."monthlyRent" >= ${where.monthlyRent.gte}`)
    if (where.monthlyRent?.lte) conditions.push(`p."monthlyRent" <= ${where.monthlyRent.lte}`)
    if (where.city) conditions.push(`lower(p.city) LIKE '%${where.city.toLowerCase()}%'`)

    const orderClause = sortBy === 'price_asc' ? `p."monthlyRent" ASC`
      : sortBy === 'price_desc' ? `p."monthlyRent" DESC`
      : sortBy === 'rating'     ? `p.rating DESC NULLS LAST`
      : sortBy === 'distance'   ? `distance_km ASC`
      : `p."createdAt" DESC`

    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        p.*,
        (6371 * acos(
          cos(radians(${lat})) * cos(radians(p.latitude)) *
          cos(radians(p.longitude) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(p.latitude))
        )) AS distance_km
      FROM "06_ras_properties" p
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderClause}
      LIMIT ${limit} OFFSET ${skip}
    `)

    const total = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*) FROM "06_ras_properties" p
      WHERE ${conditions.join(' AND ')}
    `)

    return {
      data:       rows,
      total:      Number(total[0]?.count ?? 0),
      page:       Math.floor(skip / limit) + 1,
      limit,
      totalPages: Math.ceil(Number(total[0]?.count ?? 0) / limit),
    }
  }

  private buildOrderBy(sortBy?: string) {
    switch (sortBy) {
      case 'price_asc':  return { monthlyRent: 'asc'  as const }
      case 'price_desc': return { monthlyRent: 'desc' as const }
      case 'rating':     return { rating:      'desc' as const }
      default:           return { createdAt:   'desc' as const }
    }
  }

  private fullInclude() {
    return {
      photos:    { orderBy: { sortOrder: 'asc' as const } },
      amenities: { include: { amenity: true } },
      owner: { select: { id: true, name: true, profilePhoto: true, phone: false } },
    }
  }

  private listInclude() {
    return {
      photos:    { where: { isPrimary: true }, take: 1 },
      amenities: { include: { amenity: { select: { name: true, icon: true } } }, take: 6 },
    }
  }
}
