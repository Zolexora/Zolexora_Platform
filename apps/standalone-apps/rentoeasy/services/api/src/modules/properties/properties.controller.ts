import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, UseGuards, UseInterceptors, UploadedFile,
  HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes,
  ApiBody, ApiQuery,
} from '@nestjs/swagger'
import { PropertiesService } from './properties.service'
import { RolesGuard } from '../auth/guards/index'
import { CurrentUser, Roles, Public } from '../../common/decorators/index'
import {
  CreatePropertyDto, UpdatePropertyDto, SearchPropertiesDto,
  UpdateStatusDto, ReorderPhotosDto, AdminPropertyStatusDto,
} from './dto/properties.dto'
import { User } from '@prisma/client'

@ApiTags('properties')
@UseGuards(RolesGuard)
@Controller('properties')
export class PropertiesController {
  constructor(private readonly svc: PropertiesService) {}

  // ─── PUBLIC ──────────────────────────────────────────────────────────────────

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search / filter active listings' })
  search(@Query() dto: SearchPropertiesDto) {
    return this.svc.search(dto)
  }

  @Public()
  @Get('map-pins')
  @ApiOperation({
    summary: 'Get map pins near a location',
    description: 'Lightweight — returns id, title, rent, lat/lng, photo. Max 100 results within radiusKm.',
  })
  @ApiQuery({ name: 'lat', type: Number, required: true })
  @ApiQuery({ name: 'lng', type: Number, required: true })
  @ApiQuery({ name: 'radiusKm', type: Number, required: false })
  mapPins(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radiusKm') radius?: string,
  ) {
    return this.svc.mapPins(Number(lat), Number(lng), Number(radius ?? 10))
  }

  @Public()
  @Get('amenities')
  @ApiOperation({ summary: 'Get all amenity options (WiFi, AC, Parking…)' })
  amenities() {
    return this.svc.getAmenities()
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get full property detail' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id)
  }

  // ─── OWNER ───────────────────────────────────────────────────────────────────

  @Post()
  @ApiBearerAuth()
  @Roles('owner')
  @ApiOperation({
    summary: 'Create a new listing',
    description: 'Owner must complete Aadhaar KYC before listing. Status starts as under_review.',
  })
  create(@CurrentUser() user: User, @Body() dto: CreatePropertyDto) {
    return this.svc.create(user.id, dto)
  }

  @Get('owner/my-listings')
  @ApiBearerAuth()
  @Roles('owner')
  @ApiOperation({ summary: 'Get all my listings (owner)' })
  myListings(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.ownerListings(user.id, Number(page ?? 1), Number(limit ?? 20))
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles('owner')
  @ApiOperation({ summary: 'Update listing details' })
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.svc.update(user.id, id, dto)
  }

  @Patch(':id/status')
  @ApiBearerAuth()
  @Roles('owner')
  @ApiOperation({ summary: 'Toggle listing active / inactive' })
  updateStatus(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.svc.updateStatus(user.id, id, dto)
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete listing — fails if active bookings exist' })
  delete(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.delete(user.id, id)
  }

  // ─── PHOTOS ──────────────────────────────────────────────────────────────────

  @Post(':id/photos')
  @ApiBearerAuth()
  @Roles('owner')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photo: { type: 'string', format: 'binary', description: 'JPG/PNG/WebP — max 5MB. Auto-compressed.' },
      },
    },
  })
  @ApiOperation({ summary: 'Add a photo to listing (max 10)' })
  addPhoto(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) propertyId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new Error('Photo file is required')
    return this.svc.addPhoto(user.id, propertyId, file.buffer, file.mimetype)
  }

  @Delete(':id/photos/:photoId')
  @ApiBearerAuth()
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a photo from listing' })
  deletePhoto(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) propertyId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ) {
    return this.svc.deletePhoto(user.id, propertyId, photoId)
  }

  @Patch(':id/photos/:photoId/primary')
  @ApiBearerAuth()
  @Roles('owner')
  @ApiOperation({ summary: 'Set a photo as the primary listing photo' })
  setPrimary(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) propertyId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ) {
    return this.svc.setPrimaryPhoto(user.id, propertyId, photoId)
  }

  @Patch(':id/photos/reorder')
  @ApiBearerAuth()
  @Roles('owner')
  @ApiOperation({ summary: 'Reorder photos — pass photoIds in desired order' })
  reorderPhotos(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) propertyId: string,
    @Body() dto: ReorderPhotosDto,
  ) {
    return this.svc.reorderPhotos(user.id, propertyId, dto)
  }

  // ─── ADMIN ───────────────────────────────────────────────────────────────────

  @Get('admin/all')
  @ApiBearerAuth()
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] List all properties with filters' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'city',   required: false })
  @ApiQuery({ name: 'ownerId', required: false })
  adminList(@Query() q: any) {
    return this.svc.adminList({
      ...q,
      page:  Number(q.page  ?? 1),
      limit: Number(q.limit ?? 20),
    })
  }

  @Patch('admin/:id/status')
  @ApiBearerAuth()
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] Approve, deactivate or flag a listing' })
  adminUpdateStatus(
    @CurrentUser() admin: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminPropertyStatusDto,
  ) {
    return this.svc.adminUpdateStatus(admin.id, id, dto)
  }
}
