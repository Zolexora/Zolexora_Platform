import { IsString, IsMobilePhone, Length, IsIn, IsOptional, IsUrl, MinLength, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

// ─── SEND OTP ─────────────────────────────────────────────────────────────────
export class SendOtpDto {
  @ApiProperty({ example: '9876543210' })
  @IsMobilePhone('en-IN', {}, { message: 'Enter a valid 10-digit Indian mobile number' })
  phone: string

  @ApiProperty({ enum: ['tenant', 'owner'], example: 'tenant' })
  @IsIn(['tenant', 'owner'])
  role: 'tenant' | 'owner'
}

// ─── VERIFY OTP ───────────────────────────────────────────────────────────────
export class VerifyOtpDto {
  @ApiProperty({ example: '9876543210' })
  @IsMobilePhone('en-IN', {}, { message: 'Enter a valid 10-digit Indian mobile number' })
  phone: string

  @ApiProperty({ example: '482910' })
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp: string

  @ApiProperty({ enum: ['tenant', 'owner'], example: 'tenant' })
  @IsIn(['tenant', 'owner'])
  role: 'tenant' | 'owner'

  // ── New user fields (at least name OR googleIdToken required for new users) ──

  @ApiPropertyOptional({ description: 'Full name — required for first-time signup if no Google token' })
  @IsOptional()
  @IsString()
  name?: string

  @ApiPropertyOptional({ description: 'Firebase ID token — when completing Google-first registration' })
  @IsOptional()
  @IsString()
  googleIdToken?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profilePhoto?: string

  @ApiPropertyOptional({ description: 'Password — optional, set by new users during OTP registration' })
  @IsOptional()
  @IsString()
  password?: string
}

// ─── SET PASSWORD ─────────────────────────────────────────────────────────────
export class SetPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  password: string
}

// ─── REFRESH TOKEN ────────────────────────────────────────────────────────────
export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string
}
