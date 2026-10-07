import { IsEmail, IsString, MinLength, MaxLength, IsIn, IsOptional } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

// ─── OWNER REGISTER ───────────────────────────────────────────────────────────
export class EmailRegisterDto {
  @ApiProperty({ example: 'owner@example.com' })
  @IsEmail({}, { message: 'Enter a valid email address' })
  email: string

  @ApiProperty({ example: 'Ramesh Sharma' })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100)
  name: string

  @ApiProperty({ example: 'MySecurePass@123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  password: string

  @ApiPropertyOptional({ enum: ['owner'], default: 'owner' })
  @IsOptional()
  @IsIn(['owner'])
  role?: 'owner'
}

// ─── EMAIL LOGIN ──────────────────────────────────────────────────────────────
export class EmailLoginDto {
  @ApiProperty({ example: 'owner@example.com' })
  @IsEmail({}, { message: 'Enter a valid email address' })
  email: string

  @ApiProperty({ example: 'MySecurePass@123' })
  @IsString()
  @MinLength(1)
  password: string

  @ApiProperty({ enum: ['tenant', 'owner', 'admin'], example: 'owner' })
  @IsIn(['tenant', 'owner', 'admin'])
  role: 'tenant' | 'owner' | 'admin'
}
