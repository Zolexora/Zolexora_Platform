import { Router, type Request, type Response } from 'express'
import crypto from 'node:crypto'
import { createZolexoraAuth, generateZolexoraId } from '@zolexora/user-auth-zolexora'
import { query } from '../db.js'

export const authRouter = Router()

let authInstance: ReturnType<typeof createZolexoraAuth> | null = null

function getAuth() {
  if (!authInstance) {
    authInstance = createZolexoraAuth({
      appUrl: process.env.APP_SUITE_AUTH_APP_URL || 'http://localhost:3070',
    })
  }
  return authInstance
}

// POST /api/auth/sign-in
authRouter.post('/sign-in', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const result = await getAuth().signIn(email, password)
    res.json({
      success: true,
      user: result.user,
      sessionToken: result.sessionToken,
      expiresAt: result.expiresAt,
    })
  } catch (error: unknown) {
    res.status(401).json({
      error: error instanceof Error ? error.message : 'Invalid credentials',
    })
  }
})

// POST /api/auth/sign-up
authRouter.post('/sign-up', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    await getAuth().signUp(email, password)
    res.json({
      success: true,
      message: 'User created. OTP verification email sent.',
    })
  } catch (error: unknown) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Signup failed',
    })
  }
})

// POST /api/auth/verify-otp
authRouter.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' })
    }

    const user = await getAuth().verifyEmailOtp(email, otp)
    res.json({
      success: true,
      user,
    })
  } catch (error: unknown) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Verification failed',
    })
  }
})

// POST /api/auth/firebase (Unified Firebase Token Exchange)
authRouter.post('/firebase', async (req: Request, res: Response) => {
  try {
    const { id_token, zolexora_id } = req.body
    if (!id_token) {
      return res.status(400).json({ error: 'id_token is required' })
    }

    const apiKey =
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
      'AIzaSyAogbrOXGDbmnUBfgMrMLtIDqT4EijJLZ8'

    // Verify token against Google Identity Toolkit
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: id_token }),
      }
    )

    const verifyData = (await verifyRes.json()) as any
    if (!verifyRes.ok || !verifyData.users?.[0]) {
      return res.status(401).json({ error: 'Invalid or expired Firebase ID token' })
    }

    const fbUser = verifyData.users[0]
    let email = fbUser.email?.trim().toLowerCase()
    if (!email) {
      email = fbUser.phoneNumber
        ? `${fbUser.phoneNumber.replace(/[^0-9]/g, '')}@phone.zolexora.com`
        : `${fbUser.localId}@firebase.zolexora.com`
    }

    let zxId =
      zolexora_id || (fbUser.displayName?.startsWith('ZX-') ? fbUser.displayName : null)
    if (!zxId) {
      zxId = generateZolexoraId()
    }

    // Upsert into public.zolexora_auth_users
    const userResult = await query(
      `INSERT INTO public.zolexora_auth_users (id, zolexora_id, email, password_hash, email_verified_at)
       VALUES (gen_random_uuid(), $1, $2, 'firebase-managed', now())
       ON CONFLICT (email) DO UPDATE 
         SET email_verified_at = COALESCE(public.zolexora_auth_users.email_verified_at, now())
       RETURNING id, zolexora_id, email, email_verified_at`,
      [zxId, email]
    )

    const dbUser = userResult.rows[0]

    // Create session token and store hash
    const sessionToken = crypto.randomBytes(32).toString('base64url')
    const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex')
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    await query(
      `INSERT INTO public.zolexora_auth_sessions (token_hash, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [tokenHash, dbUser.id, expiresAt]
    )

    res.json({
      success: true,
      session_token: sessionToken,
      sessionToken,
      user: {
        id: dbUser.id,
        zolexora_id: dbUser.zolexora_id,
        email: dbUser.email,
        email_verified_at: dbUser.email_verified_at,
      },
      expires_at: expiresAt.toISOString(),
    })
  } catch (error: unknown) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Firebase session exchange failed',
    })
  }
})

// GET /api/auth/session
authRouter.get('/session', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : (req.query.token as string)

    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const user = await getAuth().getUser(token)
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired session' })
    }

    res.json({ user })
  } catch (error: unknown) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Session verification failed',
    })
  }
})
