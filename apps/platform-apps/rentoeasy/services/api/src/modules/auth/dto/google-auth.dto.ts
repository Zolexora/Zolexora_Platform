import { IsString, IsIn, IsOptional } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class GoogleAuthDto {
  @ApiProperty({ description: 'Firebase ID token from Google Sign-In' })
  @IsString()
  idToken: string

  @ApiProperty({ enum: ['tenant', 'owner'] })
  @IsIn(['tenant', 'owner'])
  role: 'tenant' | 'owner'

  @ApiPropertyOptional({ description: 'Fallback name if Google profile has no display name' })
  @IsOptional()
  @IsString()
  name?: string
}
