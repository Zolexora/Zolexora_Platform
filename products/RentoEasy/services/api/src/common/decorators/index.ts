import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common'
import { User } from '@prisma/client'

// ─── @CurrentUser() ───────────────────────────────────────────────────────────
// Usage: @CurrentUser() user: User
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest()
    return request.user
  },
)

// ─── @Roles() ─────────────────────────────────────────────────────────────────
// Usage: @Roles('owner', 'admin')
export const ROLES_KEY = 'roles'
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)

// ─── @Public() ────────────────────────────────────────────────────────────────
// Usage: @Public() — skips JWT guard on that route
export const IS_PUBLIC_KEY = 'isPublic'
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
