import { IsString, Matches, IsOptional, Length } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class VerifyPANDto {
  @ApiProperty({ example: 'ABCDE1234F' })
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i, { message: 'Invalid PAN format (e.g. ABCDE1234F)' })
  panNumber: string
}

export class VerifyBankDto {
  @ApiProperty({ example: '1234567890' })
  @IsString()
  @Length(6, 18)
  accountNumber: string

  @ApiProperty({ example: 'HDFC0001234' })
  @IsString()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/i, { message: 'Invalid IFSC code' })
  ifsc: string
}

export class AadhaarFallbackDto {
  @ApiProperty({ example: 'Rahul Sharma', description: 'Name exactly as on Aadhaar card' })
  @IsString()
  nameOnAadhaar: string

  @ApiProperty({ example: '1995', description: 'Birth year (YYYY)' })
  @IsString()
  @Length(4, 4)
  birthYear: string
}

export class AdminKYCActionDto {
  @ApiProperty({ enum: ['verified', 'rejected'] })
  @IsString()
  status: 'verified' | 'rejected'

  @ApiPropertyOptional({ example: 'Document appears tampered' })
  @IsOptional()
  @IsString()
  reason?: string
}
