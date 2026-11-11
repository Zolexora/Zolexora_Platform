import {
  Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { AuthService }       from './auth.service'
import { EmailAuthService }  from './email-auth.service'
import { GoogleAuthService } from './google-auth.service'
import { SendOtpDto, VerifyOtpDto, RefreshTokenDto, SetPasswordDto } from './dto/auth.dto'
import { EmailLoginDto, EmailRegisterDto }           from './dto/email-auth.dto'
import { GoogleAuthDto }                             from './dto/google-auth.dto'
import { JwtAuthGuard }   from './guards/index'
import { CurrentUser, Public } from '../../common/decorators/index'
import { User } from '@prisma/client'

@ApiTags('auth')
@UseGuards(JwtAuthGuard)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService:       AuthService,
    private readonly emailAuthService:  EmailAuthService,
    private readonly googleAuthService: GoogleAuthService,
  ) {}

  // ─── OTP (Tenant) ──────────────────────────────────────────────────────────

  @Public()
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP to phone number (tenant)' })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto)
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP — login or register (tenant)' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto)
  }

  // ─── Google (Tenant) ───────────────────────────────────────────────────────

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login or register with Google (tenant)' })
  loginWithGoogle(@Body() dto: GoogleAuthDto) {
    return this.googleAuthService.loginWithGoogle(dto)
  }

  // ─── Email (Owner + Admin) ─────────────────────────────────────────────────

  @Public()
  @Post('email/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email + password (owner / admin)' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  emailLogin(@Body() dto: EmailLoginDto) {
    return this.emailAuthService.login(dto)
  }

  @Public()
  @Post('email/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register as owner with email + password' })
  @ApiResponse({ status: 201, description: 'Account created' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  emailRegister(@Body() dto: EmailRegisterDto) {
    return this.emailAuthService.register(dto)
  }

  // ─── Shared ────────────────────────────────────────────────────────────────

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto)
  }

  @Post('set-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set password for OTP-registered user' })
  setPassword(@CurrentUser() user: User, @Body() dto: SetPasswordDto) {
    return this.authService.setPassword(user.id, dto)
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout — invalidate refresh token' })
  logout(@CurrentUser() user: User, @Body() body: { refreshToken?: string }) {
    return this.authService.logout(user.id, body.refreshToken)
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  me(@CurrentUser() user: User) {
    return this.authService.me(user.id)
  }
}
