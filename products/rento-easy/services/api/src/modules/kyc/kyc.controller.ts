import {
  Controller, Get, Post, Patch, Body, Param,
  Query, UseGuards, UseInterceptors, UploadedFile,
  HttpCode, HttpStatus, ParseUUIDPipe, RawBodyRequest, Req,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger'
import { Request } from 'express'
import { KYCService } from './kyc.service'
import { RolesGuard } from '../auth/guards/index'
import { CurrentUser, Roles, Public } from '../../common/decorators/index'
import { VerifyPANDto, VerifyBankDto, AadhaarFallbackDto, AdminKYCActionDto } from './dto/kyc.dto'
import { User } from '@prisma/client'

@ApiTags('kyc')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('kyc')
export class KYCController {
  constructor(private readonly kyc: KYCService) {}

  // GET /api/v1/kyc/status
  @Get('status')
  @ApiOperation({ summary: 'Get KYC verification status + pending steps' })
  getStatus(@CurrentUser() user: User) {
    return this.kyc.getStatus(user.id)
  }

  // POST /api/v1/kyc/aadhaar — upload PDF (locked or unlocked)
  @Post('aadhaar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Aadhaar PDF — password-protected is fine' },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload Aadhaar PDF for verification',
    description:
      'Accepts password-protected or unlocked PDF. Auto-unlocks using known UIDAI password formula. ' +
      'If auto-unlock fails returns code=PDF_UNLOCK_FAILED — use /aadhaar/retry endpoint with name+year.',
  })
  uploadAadhaar(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new Error('PDF file is required')
    return this.kyc.processAadhaar(
      user.id,
      file.buffer,
      file.mimetype,
      { name: (user as any).name, dob: (user as any).dob ?? '1990-01-01' },
    )
  }

  // POST /api/v1/kyc/aadhaar/retry — fallback with name + year hint
  @Post('aadhaar/retry')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file:          { type: 'string', format: 'binary' },
        nameOnAadhaar: { type: 'string', example: 'RAHUL SHARMA' },
        birthYear:     { type: 'string', example: '1995' },
      },
    },
  })
  @ApiOperation({
    summary: 'Retry Aadhaar upload with name + birth year hint',
    description: 'Use when auto-unlock fails. Frontend shows name/year input, posts here.',
  })
  retryAadhaar(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: AadhaarFallbackDto,
  ) {
    if (!file) throw new Error('PDF file is required')
    return this.kyc.processAadhaarWithHint(
      user.id, file.buffer, body.nameOnAadhaar, body.birthYear,
    )
  }

  // POST /api/v1/kyc/pan
  @Post('pan')
  @Roles('owner')
  @ApiOperation({ summary: 'Verify PAN via Digio ↔ CBDT database (owner only)' })
  verifyPAN(@CurrentUser() user: User, @Body() dto: VerifyPANDto) {
    return this.kyc.verifyPAN(user.id, dto)
  }

  // POST /api/v1/kyc/bank
  @Post('bank')
  @Roles('owner')
  @ApiOperation({
    summary: 'Verify bank account via penny drop (owner only)',
    description: 'Sends ₹1 to account. Name match confirms ownership. Takes up to 60 seconds.',
  })
  verifyBank(@CurrentUser() user: User, @Body() dto: VerifyBankDto) {
    return this.kyc.verifyBank(user.id, dto)
  }

  // POST /api/v1/kyc/webhook — Digio callback (no auth — verified by payload)
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Digio webhook callback — do not call manually' })
  webhook(@Body() payload: any) {
    return this.kyc.handleWebhook(payload)
  }

  // ─── ADMIN ───────────────────────────────────────────────────────────────────

  @Get('admin/queue')
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] KYC document queue' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'submitted', 'verified', 'rejected'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  adminQueue(@Query() q: any) {
    return this.kyc.adminQueue(q.status, Number(q.page ?? 1), Number(q.limit ?? 20))
  }

  @Patch('admin/:docId')
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] Manually approve or reject a KYC document' })
  adminUpdate(
    @CurrentUser() admin: User,
    @Param('docId', ParseUUIDPipe) docId: string,
    @Body() dto: AdminKYCActionDto,
  ) {
    return this.kyc.adminUpdateStatus(admin.id, docId, dto)
  }
}
