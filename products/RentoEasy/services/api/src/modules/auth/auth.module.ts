import { Module }         from '@nestjs/common'
import { JwtModule }      from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { AuthController }       from './auth.controller'
import { AuthService }          from './auth.service'
import { EmailAuthService }     from './email-auth.service'
import { GoogleAuthService }    from './google-auth.service'
import { JwtStrategy }          from './strategies/jwt.strategy'
import { JwtAuthGuard, RolesGuard } from './guards/index'
import { MSG91Service }         from '../../config/msg91.service'

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (c: ConfigService) => ({
        secret:      c.get('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: c.get('JWT_ACCESS_EXPIRES') ?? '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers:   [AuthService, EmailAuthService, GoogleAuthService, JwtStrategy, JwtAuthGuard, RolesGuard, MSG91Service],
  exports:     [AuthService, EmailAuthService, GoogleAuthService, JwtAuthGuard, RolesGuard, JwtModule, MSG91Service],
})
export class AuthModule {}
