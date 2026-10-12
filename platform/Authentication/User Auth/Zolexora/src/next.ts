/**
 * Next.js-specific helpers for @zolexora/user-auth-zolexora.
 *
 * Import from the dedicated subpath so that `next/headers` is only bundled
 * in environments that actually run on Next.js:
 *
 *   import { createNextAuthHelpers } from '@zolexora/user-auth-zolexora/next'
 */
import { cookies } from 'next/headers'
import type { ZolexoraUser } from './types'
import type { createZolexoraAuth } from './index'

type ZolexoraAuth = ReturnType<typeof createZolexoraAuth>

/**
 * Returns a `getCurrentUser()` helper bound to a specific auth instance and
 * session cookie name.  Call this once when you initialise your auth singleton.
 *
 * @example
 * // lib/auth.ts
 * import { createZolexoraAuth } from '@zolexora/user-auth-zolexora'
 * import { createNextAuthHelpers } from '@zolexora/user-auth-zolexora/next'
 *
 * const auth = createZolexoraAuth({ appUrl: process.env.APP_SUITE_AUTH_APP_URL })
 * export const { getCurrentUser } = createNextAuthHelpers(auth, 'zolexora_app_suite_session')
 */
export function createNextAuthHelpers(
  auth: ZolexoraAuth,
  cookieName: string,
) {
  return {
    /**
     * Reads the HTTP-only session cookie and returns the authenticated user,
     * or null if the session is missing or expired.
     * Safe to call from any Server Component, Server Action, or Route Handler.
     */
    async getCurrentUser(): Promise<ZolexoraUser | null> {
      const cookieStore = await cookies()
      const sessionToken = cookieStore.get(cookieName)?.value
      if (!sessionToken) return null
      return auth.getUser(sessionToken)
    },
  }
}
