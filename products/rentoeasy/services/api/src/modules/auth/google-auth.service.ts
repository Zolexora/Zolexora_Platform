import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common'
import { JwtService }    from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as admin        from 'firebase-admin'
import { PrismaService } from '../../prisma/prisma.service'
import { GoogleAuthDto } from './dto/google-auth.dto'
import { v4 as uuidv4 }  from 'uuid'

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name)
  private fbApp: admin.app.App | null = null

  constructor(
    private prisma:  PrismaService,
    private jwt:     JwtService,
    private config:  ConfigService,
  ) {
    const projectId   = config.get('FIREBASE_PROJECT_ID')
    const clientEmail = config.get('FIREBASE_CLIENT_EMAIL')
    const privateKey  = config.get('FIREBASE_PRIVATE_KEY')

    const isConfigured =
      projectId   && !projectId.includes('your_') &&
      clientEmail && !clientEmail.includes('your_') &&
      privateKey  && !privateKey.includes('your_')

    if (isConfigured) {
      this.fbApp = admin.apps.length
        ? admin.apps[0]!
        : admin.initializeApp({
            credential: admin.credential.cert({
              projectId,
              clientEmail,
              privateKey: privateKey.replace(/\\n/g, '\n'),
            }),
          })
    } else {
      this.logger.warn(
        'Firebase Admin credentials are not configured or are placeholder; Google login is disabled until credentials are set.',
      )
    }
  }

  async loginWithGoogle(dto: GoogleAuthDto) {
    if (!this.fbApp) {
      throw new UnauthorizedException('Google login is not configured. Contact support.')
    }

    // ── 1. Verify Firebase ID token ─────────────────────────────────────────
    let decoded: admin.auth.DecodedIdToken
    try {
      decoded = await admin.auth(this.fbApp).verifyIdToken(dto.idToken)
    } catch (err: any) {
      this.logger.warn(`Invalid Google token: ${err?.message}`)
      throw new UnauthorizedException('Invalid Google token. Please try again.')
    }

    const { uid, email, name: googleName, picture } = decoded

    if (!email) {
      throw new UnauthorizedException('Google account has no email. Use another sign-in method.')
    }

    // ── 2. Check if user already exists ─────────────────────────────────────
    const existingUser = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { phone: `GOOGLE_${uid}` }] },
    })

    if (!existingUser) {
      // ── NEW USER via Google → require phone verification first ─────────────
      // Don't create account yet — frontend must collect + verify phone number
      return {
        isNewUser:      true,
        requiresPhone:  true,
        googleProfile: {
          name:  googleName ?? email.split('@')[0],
          email,
          photo: picture ?? null,
        },
        // No tokens yet — account not created
        user:         null,
        accessToken:  null,
        refreshToken: null,
      }
    }

    // ── EXISTING USER ────────────────────────────────────────────────────────
    if (!existingUser.isActive) {
      throw new UnauthorizedException('Account suspended. Contact support.')
    }

    if (existingUser.role !== dto.role && existingUser.role !== 'admin') {
      throw new ConflictException(
        `This account is registered as ${existingUser.role}. Use the ${existingUser.role} app to login.`,
      )
    }

    // Update profile photo if missing
    let user = existingUser
    if (!user.profilePhoto && picture) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data:  { profilePhoto: picture, email: user.email ?? email },
      })
    }

    // ── 3. Issue tokens ──────────────────────────────────────────────────────
    const accessToken = this.jwt.sign(
      { sub: user.id, phone: user.phone, role: user.role },
      { secret: this.config.get('JWT_ACCESS_SECRET'), expiresIn: this.config.get('JWT_ACCESS_EXPIRES') ?? '15m' },
    )

    const refreshTokenValue = uuidv4()
    await this.prisma.refreshToken.create({
      data: { token: refreshTokenValue, userId: user.id, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    })

    const { phone: _p, ...safeUser } = user

    return {
      isNewUser:     false,
      requiresPhone: false,
      googleProfile: null,
      user:          { ...safeUser, displayPhone: user.phone.startsWith('GOOGLE_') ? null : user.phone },
      accessToken,
      refreshToken:  refreshTokenValue,
      expiresIn:     900,
    }
  }
}
