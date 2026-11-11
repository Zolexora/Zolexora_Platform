import {
  IsString, IsOptional, IsEnum, IsUUID,
  IsNumber, Min, IsBoolean, Matches,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export enum PaymentMethodEnum {
  upi        = 'upi',
  upi_direct = 'upi_direct',  // direct UPI ID collect request
  card       = 'card',
  net_banking = 'net_banking',
  wallet     = 'wallet',
}

// ─── CREATE RAZORPAY ORDER ───────────────────────────────────────────────────
export class CreateOrderDto {
  @ApiProperty({ description: 'Payment UUID from DB' })
  @IsUUID()
  paymentId: string

  @ApiProperty({ enum: PaymentMethodEnum })
  @IsEnum(PaymentMethodEnum)
  method: PaymentMethodEnum

  @ApiPropertyOptional({
    example: 'rahul@okicici',
    description: 'Required when method=upi_direct. UPI ID to send collect request.',
  })
  @IsOptional()
  @IsString()
  upiId?: string
}

// ─── VERIFY RAZORPAY PAYMENT ─────────────────────────────────────────────────
export class VerifyPaymentDto {
  @ApiProperty()
  @IsString()
  razorpayOrderId: string

  @ApiProperty()
  @IsString()
  razorpayPaymentId: string

  @ApiProperty()
  @IsString()
  razorpaySignature: string
}

// ─── DIRECT UPI COLLECT ───────────────────────────────────────────────────────
export class UPICollectDto {
  @ApiProperty({ description: 'Payment UUID from DB' })
  @IsUUID()
  paymentId: string

  @ApiProperty({
    example: 'rahul@okicici',
    description: 'Tenant UPI ID — collect request will be sent here',
  })
  @IsString()
  @Matches(/^[\w.\-]+@[\w.\-]+$/, { message: 'Invalid UPI ID format (e.g. rahul@okicici)' })
  upiId: string
}

// ─── SETUP AUTO-PAY MANDATE ──────────────────────────────────────────────────
export class SetupAutoPayDto {
  @ApiProperty({ description: 'Booking UUID to setup recurring mandate for' })
  @IsUUID()
  bookingId: string

  @ApiProperty({ enum: ['upi', 'card', 'net_banking'], description: 'Method for recurring debit' })
  @IsEnum(['upi', 'card', 'net_banking'])
  method: string

  @ApiPropertyOptional({ example: 'rahul@okicici', description: 'UPI ID if method=upi' })
  @IsOptional()
  @IsString()
  upiId?: string
}

// ─── ADMIN MANUAL PAYOUT ─────────────────────────────────────────────────────
export class ManualPayoutDto {
  @ApiProperty({ description: 'Payment UUID to payout manually' })
  @IsUUID()
  paymentId: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string
}

// ─── ADMIN REFUND ─────────────────────────────────────────────────────────────
export class RefundDto {
  @ApiProperty({ description: 'Payment UUID to refund' })
  @IsUUID()
  paymentId: string

  @ApiPropertyOptional({ description: 'Partial refund amount in paise. Omit for full refund.' })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Type(() => Number)
  amountPaise?: number

  @ApiProperty({ example: 'Tenant cancelled before move-in' })
  @IsString()
  reason: string
}
