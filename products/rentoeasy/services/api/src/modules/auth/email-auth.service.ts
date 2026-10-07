import {
  Injectable, BadRequestException, UnauthorizedException,
  ConflictException, Logger,
} from '@nestjs/common'
import { JwtService }     from '@nestjs/jwt'
import { ConfigService }  from '@nestjs/config'
import { PrismaService }  from '../../prisma/prisma.service'
import { EmailLoginDto, EmailRegisterDto } from './dto/email-auth.dto'
import { v4 as uuidv4 }  from 'uuid'
import * as bcrypt        from 'bcryptjs'

const SALT_ROUNDS = 12

@Injectable()
export class EmailAuthService {
  private readonly logger = new Logger(EmailAuthService.name)

  constructor(
    private prisma:  PrismaService,
    private jwt:     JwtService,
    private config:  ConfigService,
  ) {}

  // ─── OWNER REGISTER ─────────────────────────────────────────────────────────
  async register(dto: EmailRegisterDto) {
    const email = dto.email.toLowerCase().trim()

    const existing = await this.prisma.user.findUnique({ where: { email } })
    if (existing) {
      throw new ConflictException('An account with this email already exists.')
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS)

    const user = await this.prisma.user.create({
      data: {
        email,
        name:         dto.name.trim(),
        role:         'owner',
        phone:        `EMAIL_${uuidv4()}`, // placeholder — owners don't need phone
        passwordHash,
        kycStatus:    'pending',
        isActive:     true,
      },
    })

    this.logger.log(`New owner registered via email: ${user.id}`)

    const tokens = await this.issueTokens(user)
    const { passwordHash: _, ...safeUser } = user

    return { isNewUser: true, user: safeUser, ...tokens }
  }

  // ─── EMAIL LOGIN (owner + admin) ─────────────────────────────────────────────
  async login(dto: EmailLoginDto) {
    const email = dto.email.toLowerCase().trim()

    const user = await this.prisma.user.findUnique({ where: { email } })

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password.')
    }

    if (user.role !== dto.role && user.role !== 'admin') {
      throw new UnauthorizedException('Invalid email or password.')
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been suspended. Contact support.')
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash)
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password.')
    }

    const tokens = await this.issueTokens(user)
    const { passwordHash: _, ...safeUser } = user

    return { isNewUser: false, user: safeUser, ...tokens }
  }

  // ─── PRIVATE ─────────────────────────────────────────────────────────────────
  private async issueTokens(user: any) {
    const accessToken = this.jwt.sign(
      { sub: user.id, phone: user.phone, role: user.role },
      { secret: this.config.get('JWT_ACCESS_SECRET'), expiresIn: this.config.get('JWT_ACCESS_EXPIRES') ?? '15m' },
    )
    const refreshTokenValue = uuidv4()
    await this.prisma.refreshToken.create({
      data: { token: refreshTokenValue, userId: user.id, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    })
    return { accessToken, refreshToken: refreshTokenValue, expiresIn: 900 }
  }
}
