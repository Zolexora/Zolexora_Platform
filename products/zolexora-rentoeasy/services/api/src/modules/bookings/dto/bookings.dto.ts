import {
  IsString, IsDateString, IsOptional, IsEnum,
  IsUUID, MaxLength, IsNumber, Min,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateBookingDto {
  @ApiProperty({ description: 'Property UUID to book' })
  @IsUUID()
  propertyId: string

  @ApiProperty({ example: '2025-02-01', description: 'Requested move-in date' })
  @IsDateString()
  moveInDate: string

  @ApiPropertyOptional({ example: 'I am a working professional, non-smoker.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string
}

export class RespondBookingDto {
  @ApiProperty({ enum: ['accepted', 'rejected'] })
  @IsEnum(['accepted', 'rejected'])
  action: 'accepted' | 'rejected'

  @ApiPropertyOptional({ example: 'Already rented to another tenant' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string
}

export class CancelBookingDto {
  @ApiPropertyOptional({ example: 'Found a better place' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string
}

export class UpdatePoliceVerificationDto {
  @ApiProperty({ enum: ['pending', 'submitted', 'verified'] })
  @IsEnum(['pending', 'submitted', 'verified'])
  status: 'pending' | 'submitted' | 'verified'
}

export class AdminBookingQueryDto {
  @IsOptional() @IsEnum(['pending','accepted','rejected','active','cancelled','completed'])
  status?: string

  @IsOptional() @IsString()
  tenantId?: string

  @IsOptional() @IsString()
  ownerId?: string

  @IsOptional() @IsString()
  propertyId?: string

  @IsOptional() @IsNumber() @Min(1) @Type(() => Number)
  page?: number

  @IsOptional() @IsNumber() @Min(1) @Type(() => Number)
  limit?: number
}
