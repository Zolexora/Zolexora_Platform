import {
  IsString,
  IsOptional,
  IsEmail,
  IsIn,
  MaxLength,
  MinLength,
  Matches,
  IsNumberString,
} from 'class-validator'
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger'

// ─── UPDATE PROFILE (shared tenant + owner) ───────────────────────────────────
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Rahul Sharma' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string

  @ApiPropertyOptional({ example: 'rahul@email.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Enter a valid email address' })
  email?: string
}

// ─── TENANT PROFILE UPDATE ────────────────────────────────────────────────────
export class UpdateTenantProfileDto extends UpdateProfileDto {
  @ApiPropertyOptional({ example: '12, MG Road, Bengaluru, Karnataka 560001' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  permanentAddress?: string

  @ApiPropertyOptional({ example: 'Bengaluru' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string

  @ApiPropertyOptional({ enum: ['aadhaar', 'pan', 'passport', 'voter'] })
  @IsOptional()
  @IsIn(['aadhaar', 'pan', 'passport', 'voter'])
  declaredIdType?: string

  @ApiPropertyOptional({ example: '1234', description: 'Last 4 digits of declared ID' })
  @IsOptional()
  @IsNumberString()
  @MinLength(4)
  @MaxLength(4)
  declaredIdLastFour?: string
}

// ─── OWNER PROFILE UPDATE ─────────────────────────────────────────────────────
export class UpdateOwnerProfileDto extends UpdateProfileDto {
  @ApiPropertyOptional({ example: 'ABCDE1234F' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, {
    message: 'Enter a valid PAN number (e.g. ABCDE1234F)',
  })
  panNumber?: string
}

// ─── UPDATE FCM TOKEN ─────────────────────────────────────────────────────────
export class UpdateFCMTokenDto {
  @ApiProperty({ description: 'Firebase Cloud Messaging device token' })
  @IsString()
  @MinLength(10)
  fcmToken: string
}

// ─── UPDATE DEVICE ID ─────────────────────────────────────────────────────────
export class UpdateDeviceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fcmToken?: string
}
