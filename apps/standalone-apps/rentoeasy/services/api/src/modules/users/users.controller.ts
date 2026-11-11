import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger'
import { UsersService } from './users.service'
import { RolesGuard } from '../auth/guards/index'
import { CurrentUser, Roles } from '../../common/decorators/index'
import {
  UpdateTenantProfileDto,
  UpdateOwnerProfileDto,
  UpdateFCMTokenDto,
  UpdateDeviceDto,
} from './dto/users.dto'
import { User } from '@prisma/client'

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── OWN PROFILE ─────────────────────────────────────────────────────────────

  // GET /api/v1/users/me
  @Get('me')
  @ApiOperation({ summary: 'Get own full profile with KYC status' })
  getMe(@CurrentUser() user: User) {
    return this.usersService.getProfile(user.id)
  }

  // PATCH /api/v1/users/me/tenant
  @Patch('me/tenant')
  @Roles('tenant')
  @ApiOperation({ summary: 'Update tenant profile (name, email, address, city, declared ID)' })
  updateTenantProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateTenantProfileDto,
  ) {
    return this.usersService.updateTenantProfile(user.id, dto)
  }

  // PATCH /api/v1/users/me/owner
  @Patch('me/owner')
  @Roles('owner')
  @ApiOperation({ summary: 'Update owner profile (name, email, PAN)' })
  updateOwnerProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateOwnerProfileDto,
  ) {
    return this.usersService.updateOwnerProfile(user.id, dto)
  }

  // POST /api/v1/users/me/photo
  @Post('me/photo')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photo: { type: 'string', format: 'binary', description: 'JPG/PNG/WebP, max 5MB' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload / replace profile photo' })
  uploadPhoto(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new Error('Photo file is required')
    return this.usersService.uploadProfilePhoto(user.id, file.buffer, file.mimetype)
  }

  // PATCH /api/v1/users/me/fcm-token
  @Patch('me/fcm-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update FCM push notification token (call on every app launch)' })
  updateFCMToken(
    @CurrentUser() user: User,
    @Body() dto: UpdateFCMTokenDto,
  ) {
    return this.usersService.updateFCMToken(user.id, dto)
  }

  // PATCH /api/v1/users/me/device
  @Patch('me/device')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update device fingerprint + FCM token (called silently on app launch)' })
  updateDevice(
    @CurrentUser() user: User,
    @Body() dto: UpdateDeviceDto,
  ) {
    return this.usersService.updateDevice(user.id, dto)
  }

  // DELETE /api/v1/users/me
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate own account',
    description: 'Fails if active bookings exist. Revokes all sessions.',
  })
  deactivate(@CurrentUser() user: User) {
    return this.usersService.deactivateAccount(user.id)
  }

  // ─── PUBLIC PROFILE (owner viewing tenant) ────────────────────────────────────

  // GET /api/v1/users/:id/public
  @Get(':id/public')
  @ApiOperation({
    summary: 'Get public profile of another user',
    description: 'Owner can view tenant public profile only if a booking exists between them.',
  })
  getPublicProfile(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) targetId: string,
  ) {
    return this.usersService.getPublicProfile(user.id, targetId)
  }

  // ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────

  // GET /api/v1/users (admin only)
  @Get()
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] List all users with filters' })
  @ApiQuery({ name: 'role', required: false, enum: ['tenant', 'owner'] })
  @ApiQuery({ name: 'kycStatus', required: false, enum: ['pending', 'submitted', 'verified', 'rejected'] })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name, phone, or email' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  adminListUsers(@Query() query: any) {
    return this.usersService.adminGetUsers({
      ...query,
      isActive: query.isActive !== undefined
        ? query.isActive === 'true'
        : undefined,
      page:  query.page  ? Number(query.page)  : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
    })
  }

  // GET /api/v1/users/:id (admin only)
  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] Get full user detail with bookings, KYC, properties' })
  adminGetUser(@Param('id', ParseUUIDPipe) userId: string) {
    return this.usersService.adminGetUserDetail(userId)
  }

  // PATCH /api/v1/users/:id/status (admin only)
  @Patch(':id/status')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Suspend or reactivate a user account' })
  @ApiResponse({ status: 200, description: 'User status updated' })
  @ApiResponse({ status: 403, description: 'Cannot suspend admin accounts' })
  adminToggleStatus(
    @CurrentUser() admin: User,
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() body: { isActive: boolean; reason?: string },
  ) {
    return this.usersService.adminToggleUserStatus(admin.id, userId, body.isActive, body.reason)
  }
}
