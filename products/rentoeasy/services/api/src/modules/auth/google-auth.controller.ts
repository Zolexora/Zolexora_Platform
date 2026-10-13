import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse }           from '@nestjs/swagger'
import { GoogleAuthService }                            from './google-auth.service'
import { GoogleAuthDto }                                from './dto/google-auth.dto'
import { Public }                                       from '../../common/decorators/index'

@ApiTags('auth')
@Controller('auth')
export class GoogleAuthController {
  constructor(private readonly googleAuth: GoogleAuthService) {}

  // POST /api/v1/auth/google
  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login / register with Google',
    description:
      'Verify Firebase ID token from Google Sign-In. ' +
      'Creates account if new. Returns same shape as /auth/verify-otp. ' +
      'isNewUser=true means first-time Google login.',
  })
  @ApiResponse({ status: 200, description: 'Login success' })
  @ApiResponse({ status: 401, description: 'Invalid Google token' })
  @ApiResponse({ status: 409, description: 'Email registered under different role' })
  loginWithGoogle(@Body() dto: GoogleAuthDto) {
    return this.googleAuth.loginWithGoogle(dto)
  }
}
