import { createZolexoraAuth, type ZolexoraUser, type StoredZolexoraUser } from '@zolexora/user-auth-zolexora'
import { createNextAuthHelpers } from '@zolexora/user-auth-zolexora/next'
import { SESSION_COOKIE_NAME } from './auth-constants'

export type { ZolexoraUser, StoredZolexoraUser }
export { SESSION_COOKIE_NAME }

const globalForAuth = globalThis as unknown as {
  zolexoraTeamAuth?: ReturnType<typeof createZolexoraAuth>
}

export function getZolexoraAuth() {
  if (!globalForAuth.zolexoraTeamAuth) {
    globalForAuth.zolexoraTeamAuth = createZolexoraAuth({
      appUrl: process.env.DEV_TEAM_AUTH_APP_URL || 'http://localhost:3071',
    })
  }
  return globalForAuth.zolexoraTeamAuth
}

export const { getCurrentUser } = createNextAuthHelpers(
  getZolexoraAuth,
  SESSION_COOKIE_NAME,
)
