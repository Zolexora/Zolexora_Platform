# Zolexora User Auth

Independent server-side email/password auth for Zolexora apps. The module connects directly to PostgreSQL with `pg` and sends verification/reset emails with Resend.

## Configure once

Apply [`schema.sql`](./schema.sql) to the dedicated authentication database. Set these server environment variables:

```env
ZOLEXORA_AUTHENTICATION_DATABASE_URL=postgresql://...
ZOLEXORA_PRODUCTION_RESEND_API_KEY=re_...
AUTH_FROM_EMAIL="Zolexora <auth@zolexora.com>"
AUTH_APP_URL=https://your-app.example.com
```

Use a database credential with access limited to the three `zolexora_auth_*` tables. Keep all four values on the server. Use a verified Resend sender domain.

## Use in an app

Create one auth instance per server process and import it from your server routes/actions. Do not create a new instance for each request, since it owns a small connection pool.

```ts
import { createZolexoraAuth } from '@zolexora/user-auth-zolexora'

export const auth = createZolexoraAuth()

// Sign-up sends an email link to /verify-email?token=...
await auth.signUp(email, password)
await auth.verifyEmail(token)

// Save sessionToken in an HttpOnly, Secure, SameSite=Lax cookie.
const { user, sessionToken, expiresAt } = await auth.signIn(email, password)
const sessionUser = await auth.getUser(sessionToken)
await auth.signOut(sessionToken)

await auth.requestPasswordReset(email) // same response if account is unknown
await auth.resetPassword(token, newPassword) // also revokes all sessions
await auth.resendVerification(email)
```

Your app provides the sign-in page and verification/reset routes. Those routes call the matching auth methods. The default email paths are `/verify-email` and `/reset-password`; configure `verificationPath` or `passwordResetPath` if your app uses different routes. Set `maxDbConnections` if your deployment needs a smaller pool.

Passwords use scrypt; session and email tokens are random, while only their SHA-256 hashes are stored. Rate-limit sign-up, sign-in, verification, and reset endpoints at your app or edge layer. Use a Node.js server runtime, not Edge Runtime.
