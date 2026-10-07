import {
  Injectable, BadRequestException, UnauthorizedException,
  ConflictException, Logger, NotFoundException,
} from '@nestjs/common'
import { JwtService }     from '@nestjs/jwt'
import { ConfigService }  from '@nestjs/config'
import { PrismaService }  from '../../prisma/prisma.service'
import { MSG91Service }   from '../../config/msg91.service'
import { SendOtpDto, VerifyOtpDto, RefreshTokenDto, SetPasswordDto } from './dto/auth.dto'
import { JwtPayload }     from './strategies/jwt.strategy'
import { User }           from '@prisma/client'
import { v4 as uuidv4 }  from 'uuid'
import * as admin         from 'firebase-admin'
import * as bcrypt        from 'bcryptjs'

const SALT_ROUNDS = 12

@Injectable()
export class AuthService {
  private readonly logger            = new Logger(AuthService.name)
  private readonly OTP_EXPIRY_SECONDS = 300
  private readonly MAX_OTP_ATTEMPTS   = 5

  constructor(
    private prisma:  PrismaService,
    private jwt:     JwtService,
    private config:  ConfigService,
    private msg91:   MSG91Service,
  ) {}

  // ─── SEND OTP ───────────────────────────────────────────────────────────────

  async sendOtp(dto: SendOtpDto) {
    const phone = this.normalizePhone(dto.phone)

    // Rate limit
    const recentCount = await this.prisma.oTP.count({
      where: { phone, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
    })
    if (recentCount >= 5) {
      throw new BadRequestException('Too many OTP requests. Please wait 10 minutes.')
    }

    // Invalidate previous OTPs
    await this.prisma.oTP.updateMany({ where: { phone, used: false }, data: { used: true } })

    const code      = this.generateOTP()
    const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_SECONDS * 1000)

    await this.prisma.oTP.create({ data: { phone, code, expiresAt } })

    if (process.env.NODE_ENV === 'production') {
      await this.msg91.sendOTP(phone, code)
    } else {
      this.logger.log(`[DEV] OTP for ${phone}: ${code}`)
    }

    return { message: `OTP sent to ${this.maskPhone(phone)}`, expiresIn: this.OTP_EXPIRY_SECONDS }
  }

  // ─── VERIFY OTP ─────────────────────────────────────────────────────────────

  async verifyOtp(dto: VerifyOtpDto) {
    const phone = this.normalizePhone(dto.phone)

    // Find latest valid OTP
    const otpRecord = await this.prisma.oTP.findFirst({
      where: { phone, used: false },
      orderBy: { createdAt: 'desc' },
    })

    if (!otpRecord) throw new BadRequestException('No active OTP. Please request a new one.')

    if (new Date() > otpRecord.expiresAt) {
      await this.prisma.oTP.update({ where: { id: otpRecord.id }, data: { used: true } })
      throw new BadRequestException('OTP has expired. Please request a new one.')
    }

    if (otpRecord.attempts >= this.MAX_OTP_ATTEMPTS) {
      await this.prisma.oTP.update({ where: { id: otpRecord.id }, data: { used: true } })
      throw new BadRequestException('Too many attempts. Please request a new OTP.')
    }

    if (otpRecord.code !== dto.otp) {
      await this.prisma.oTP.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      })
      const remaining = this.MAX_OTP_ATTEMPTS - otpRecord.attempts - 1
      throw new BadRequestException(`Incorrect OTP. ${remaining} attempt(s) remaining.`)
    }

    // ── OTP is valid — check user ──────────────────────────────────────────────
    let user = await this.prisma.user.findUnique({ where: { phone } })
    const isNewUser = !user

    if (isNewUser) {
      // ── Resolve profile from Google token or manual input ──────────────────
      let resolvedName  = dto.name?.trim()
      let resolvedEmail = dto.email
      let resolvedPhoto = dto.profilePhoto

      if (dto.googleIdToken) {
        // Verify Google token and pull profile
        const googleProfile = await this.verifyGoogleToken(dto.googleIdToken)
        resolvedName  = resolvedName  || googleProfile.name
        resolvedEmail = resolvedEmail || googleProfile.email
        resolvedPhoto = resolvedPhoto || (googleProfile.photo ?? undefined)
      }

      if (!resolvedName) {
        // Don't consume OTP yet — let frontend supply name/Google token
        // Return isNewUser: true so frontend knows to show next step
        return { isNewUser: true, requiresProfile: true, user: null, accessToken: null, refreshToken: null }
      }

      // Mark OTP as used only when we're about to create the user
      await this.prisma.oTP.update({ where: { id: otpRecord.id }, data: { used: true } })

      user = await this.prisma.user.create({
        data: {
          phone,
          name:         resolvedName,
          role:         dto.role,
          email:        resolvedEmail ?? null,
          profilePhoto: resolvedPhoto ?? null,
          kycStatus:    'pending',
          passwordHash: dto.password ? await bcrypt.hash(dto.password, SALT_ROUNDS) : null,
        },
      })
      this.logger.log(`New ${dto.role} registered: ${user.id}`)

    } else {
      // ── Existing user ────────────────────────────────────────────────────────
      if (user!.role !== dto.role && user!.role !== 'admin') {
        throw new ConflictException(
          `This number is registered as ${user!.role}. Use the ${user!.role} app to login.`,
        )
      }
      if (!user!.isActive) {
        throw new UnauthorizedException('Your account has been suspended. Contact support.')
      }

      // Mark OTP as used
      await this.prisma.oTP.update({ where: { id: otpRecord.id }, data: { used: true } })
    }

    const tokens = await this.issueTokens(user!)

    return { isNewUser, user: this.sanitizeUser(user!), ...tokens }
  }

  // ─── SET PASSWORD ────────────────────────────────────────────────────────────

  async setPassword(userId: string, dto: SetPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS)
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } })
    return { message: 'Password set successfully' }
  }

  // ─── REFRESH ────────────────────────────────────────────────────────────────

  async refreshToken(dto: RefreshTokenDto) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: dto.refreshToken },
      include: { user: true },
    })
    if (!stored) throw new UnauthorizedException('Invalid refresh token.')
    if (new Date() > stored.expiresAt) {
      await this.prisma.refreshToken.delete({ where: { id: stored.id } })
      throw new UnauthorizedException('Refresh token expired. Please login again.')
    }
    if (!stored.user.isActive) throw new UnauthorizedException('Account suspended.')

    await this.prisma.refreshToken.delete({ where: { id: stored.id } })
    const tokens = await this.issueTokens(stored.user)
    return { user: this.sanitizeUser(stored.user), ...tokens }
  }

  // ─── LOGOUT ─────────────────────────────────────────────────────────────────

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.deleteMany({ where: { userId, token: refreshToken } })
    } else {
      await this.prisma.refreshToken.deleteMany({ where: { userId } })
    }
    return { message: 'Logged out successfully' }
  }

  // ─── ME ─────────────────────────────────────────────────────────────────────

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')
    return this.sanitizeUser(user)
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────────────────────

  private async verifyGoogleToken(idToken: string) {
    try {
      const fbApp = admin.apps.length ? admin.apps[0]! : null
      if (!fbApp) throw new Error('Firebase not initialized')
      const decoded = await admin.auth(fbApp).verifyIdToken(idToken)
      return {
        name:  decoded.name   ?? null,
        email: decoded.email  ?? null,
        photo: decoded.picture ?? null,
      }
    } catch {
      throw new BadRequestException('Invalid Google token.')
    }
  }

  private async issueTokens(user: User) {
    const payload: JwtPayload = { sub: user.id, phone: user.phone, role: user.role }
    const accessToken = this.jwt.sign(payload, {
      secret:    this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES') ?? '15m',
    })
    const refreshTokenValue = uuidv4()
    await this.prisma.refreshToken.create({
      data: { token: refreshTokenValue, userId: user.id, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    })
    return { accessToken, refreshToken: refreshTokenValue, expiresIn: 900 }
  }

  private generateOTP() {
    return String(Math.floor(Math.random() * 900000) + 100000)
  }

  private normalizePhone(phone: string) {
    return phone.replace(/^\+91/, '').replace(/\D/g, '').slice(-10)
  }

  private maskPhone(phone: string) {
    return `${phone.slice(0, 2)}XXXXXX${phone.slice(-2)}`
  }

  private sanitizeUser(user: User) {
    const { ...safe } = user
    return safe
  }
}
