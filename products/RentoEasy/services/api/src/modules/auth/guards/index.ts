import {
  Injectable,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Reflector } from '@nestjs/core'
import { IS_PUBLIC_KEY, ROLES_KEY } from '../../../common/decorators/index'

// ─── JWT AUTH GUARD ───────────────────────────────────────────────────────────
// Applied globally in AppModule. Skips routes marked @Public()
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super()
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true
    return super.canActivate(context)
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Invalid or expired token')
    }
    return user
  }
}

// ─── ROLES GUARD ─────────────────────────────────────────────────────────────
// Usage: @UseGuards(RolesGuard) + @Roles('owner', 'admin')
@Injectable()
export class RolesGuard {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!requiredRoles || requiredRoles.length === 0) return true

    const { user } = context.switchToHttp().getRequest()
    if (!user) throw new UnauthorizedException()

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Access denied. Required role: ${requiredRoles.join(' or ')}`,
      )
    }
    return true
  }
}
