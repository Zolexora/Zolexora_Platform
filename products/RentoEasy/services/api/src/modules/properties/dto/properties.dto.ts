import {
  IsString, IsNumber, IsOptional, IsEnum, IsArray,
  IsDateString, IsBoolean, Min, Max, MaxLength,
  MinLength, IsLatitude, IsLongitude, ArrayMaxSize,
} from 'class-validator'
import { Type, Transform } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export enum PropertyTypeEnum  { single = 'single', shared = 'shared', pg = 'pg', flat = 'flat', studio = 'studio' }
export enum FurnishingEnum    { furnished = 'furnished', semi_furnished = 'semi_furnished', unfurnished = 'unfurnished' }
export enum GenderPrefEnum    { male = 'male', female = 'female', any = 'any' }
export enum SortByEnum        { price_asc = 'price_asc', price_desc = 'price_desc', newest = 'newest', rating = 'rating', distance = 'distance' }

// ─── CREATE LISTING ──────────────────────────────────────────────────────────
export class CreatePropertyDto {
  @ApiProperty({ example: 'Furnished 1BHK near Metro, Koramangala' })
  @IsString() @MinLength(10) @MaxLength(120)
  title: string

  @ApiProperty({ example: 'Spacious room with AC, WiFi and 24hr security...' })
  @IsString() @MinLength(20) @MaxLength(2000)
  description: string

  @ApiProperty({ enum: PropertyTypeEnum })
  @IsEnum(PropertyTypeEnum)
  type: PropertyTypeEnum

  @ApiProperty({ example: 12000, description: 'Monthly rent in rupees' })
  @IsNumber() @Min(1000) @Max(500000)
  @Type(() => Number)
  monthlyRent: number

  @ApiProperty({ example: 24000, description: 'Security deposit in rupees' })
  @IsNumber() @Min(0) @Max(1000000)
  @Type(() => Number)
  securityDeposit: number

  @ApiProperty({ enum: FurnishingEnum })
  @IsEnum(FurnishingEnum)
  furnishing: FurnishingEnum

  @ApiPropertyOptional({ enum: GenderPrefEnum, default: 'any' })
  @IsOptional() @IsEnum(GenderPrefEnum)
  genderPreference?: GenderPrefEnum

  @ApiPropertyOptional({ example: 'No smoking, No pets, Guests allowed till 10pm' })
  @IsOptional() @IsString() @MaxLength(500)
  rules?: string

  @ApiProperty({ example: '2025-02-01', description: 'Available from date (YYYY-MM-DD)' })
  @IsDateString()
  availableFrom: string

  // Address
  @ApiProperty({ example: '12, 5th Cross, Koramangala 4th Block' })
  @IsString() @MinLength(5) @MaxLength(200)
  addressLine1: string

  @ApiPropertyOptional({ example: 'Near Forum Mall' })
  @IsOptional() @IsString() @MaxLength(200)
  addressLine2?: string

  @ApiProperty({ example: 'Bengaluru' })
  @IsString() @MaxLength(60)
  city: string

  @ApiProperty({ example: 'Karnataka' })
  @IsString() @MaxLength(60)
  state: string

  @ApiProperty({ example: '560034' })
  @IsString() @MinLength(6) @MaxLength(6)
  pincode: string

  @ApiPropertyOptional({ example: 'Near Koramangala Water Tank' })
  @IsOptional() @IsString() @MaxLength(100)
  landmark?: string

  @ApiProperty({ example: 12.9352, description: 'Latitude — use Google Maps to find' })
  @IsLatitude()
  @Type(() => Number)
  latitude: number

  @ApiProperty({ example: 77.6245 })
  @IsLongitude()
  @Type(() => Number)
  longitude: number

  @ApiPropertyOptional({ example: ['wifi', 'ac', 'parking'], description: 'Amenity IDs' })
  @IsOptional() @IsArray() @ArrayMaxSize(20)
  amenityIds?: string[]
}

// ─── UPDATE LISTING ──────────────────────────────────────────────────────────
export class UpdatePropertyDto {
  @IsOptional() @IsString() @MinLength(10) @MaxLength(120) title?: string
  @IsOptional() @IsString() @MinLength(20) @MaxLength(2000) description?: string
  @IsOptional() @IsEnum(PropertyTypeEnum)  type?: PropertyTypeEnum
  @IsOptional() @IsNumber() @Min(1000) @Max(500000) @Type(() => Number) monthlyRent?: number
  @IsOptional() @IsNumber() @Min(0) @Max(1000000)   @Type(() => Number) securityDeposit?: number
  @IsOptional() @IsEnum(FurnishingEnum)   furnishing?: FurnishingEnum
  @IsOptional() @IsEnum(GenderPrefEnum)   genderPreference?: GenderPrefEnum
  @IsOptional() @IsString() @MaxLength(500) rules?: string
  @IsOptional() @IsDateString()           availableFrom?: string
  @IsOptional() @IsString() @MaxLength(200) addressLine1?: string
  @IsOptional() @IsString() @MaxLength(200) addressLine2?: string
  @IsOptional() @IsString() @MaxLength(60)  city?: string
  @IsOptional() @IsString() @MaxLength(60)  state?: string
  @IsOptional() @IsString() @MaxLength(6)   pincode?: string
  @IsOptional() @IsString() @MaxLength(100) landmark?: string
  @IsOptional() @IsLatitude()  @Type(() => Number) latitude?: number
  @IsOptional() @IsLongitude() @Type(() => Number) longitude?: number
  @IsOptional() @IsArray() @ArrayMaxSize(20) amenityIds?: string[]
}

// ─── UPDATE STATUS ───────────────────────────────────────────────────────────
export class UpdateStatusDto {
  @ApiProperty({ enum: ['active', 'inactive'] })
  @IsEnum(['active', 'inactive'])
  status: 'active' | 'inactive'
}

// ─── SEARCH / FILTER QUERY ───────────────────────────────────────────────────
export class SearchPropertiesDto {
  @ApiPropertyOptional({ example: 'Bengaluru' })
  @IsOptional() @IsString()
  city?: string

  @ApiPropertyOptional({ example: '560034' })
  @IsOptional() @IsString()
  pincode?: string

  @ApiPropertyOptional({ description: 'Search by text in title/description' })
  @IsOptional() @IsString()
  q?: string

  // Geo search — provide lat+lng+radius for map-based search
  @ApiPropertyOptional({ example: 12.9352 })
  @IsOptional() @IsLatitude() @Type(() => Number)
  lat?: number

  @ApiPropertyOptional({ example: 77.6245 })
  @IsOptional() @IsLongitude() @Type(() => Number)
  lng?: number

  @ApiPropertyOptional({ example: 5, description: 'Radius in km for geo search (default 5)' })
  @IsOptional() @IsNumber() @Min(0.5) @Max(50) @Type(() => Number)
  radiusKm?: number

  @ApiPropertyOptional({ enum: PropertyTypeEnum })
  @IsOptional() @IsEnum(PropertyTypeEnum)
  type?: PropertyTypeEnum

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  minRent?: number

  @ApiPropertyOptional({ example: 30000 })
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  maxRent?: number

  @ApiPropertyOptional({ enum: FurnishingEnum })
  @IsOptional() @IsEnum(FurnishingEnum)
  furnishing?: FurnishingEnum

  @ApiPropertyOptional({ enum: GenderPrefEnum })
  @IsOptional() @IsEnum(GenderPrefEnum)
  genderPreference?: GenderPrefEnum

  @ApiPropertyOptional({ enum: SortByEnum, default: 'newest' })
  @IsOptional() @IsEnum(SortByEnum)
  sortBy?: SortByEnum

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @IsNumber() @Min(1) @Type(() => Number)
  page?: number

  @ApiPropertyOptional({ default: 20, description: 'Max 50' })
  @IsOptional() @IsNumber() @Min(1) @Max(50) @Type(() => Number)
  limit?: number
}

// ─── PHOTO SORT ORDER ────────────────────────────────────────────────────────
export class ReorderPhotosDto {
  @ApiProperty({ example: ['photo-id-1', 'photo-id-2'], description: 'Photo IDs in desired order' })
  @IsArray()
  photoIds: string[]
}

// ─── ADMIN STATUS ────────────────────────────────────────────────────────────
export class AdminPropertyStatusDto {
  @IsEnum(['active', 'inactive', 'under_review'])
  status: 'active' | 'inactive' | 'under_review'

  @IsOptional() @IsString()
  reason?: string
}
