import { createZolexoraAuth, type ZolexoraUser, type StoredZolexoraUser } from '@zolexora/user-auth-zolexora'
import { createNextAuthHelpers } from '@zolexora/user-auth-zolexora/next'

export type { ZolexoraUser, StoredZolexoraUser }

export const SESSION_COOKIE_NAME = 'zolexora_app_suite_session'

// Required env vars (set in Infisical):
//   ZOLEXORA_AUTHENTICATION_DATABASE_URL
//   ZOLEXORA_PRODUCTION_RESEND_API_KEY
//   AUTH_FROM_EMAIL
//   APP_SUITE_AUTH_APP_URL
const globalForAuth = globalThis as unknown as {
  zolexoraAuth?: ReturnType<typeof createZolexoraAuth>
}

export function getZolexoraAuth() {
  if (!globalForAuth.zolexoraAuth) {
    globalForAuth.zolexoraAuth = createZolexoraAuth({
      // Infisical key is APP_SUITE_AUTH_APP_URL; package reads AUTH_APP_URL by default
      appUrl: process.env.APP_SUITE_AUTH_APP_URL,
    })
  }
  return globalForAuth.zolexoraAuth
}

// getCurrentUser() lives in @zolexora/user-auth-zolexora/next — reusable across all Zolexora Next.js apps
export const { getCurrentUser } = createNextAuthHelpers(
  getZolexoraAuth(),
  SESSION_COOKIE_NAME,
)
