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
      resendApiKey: process.env.ZOLEXORA_PRODUCTION_RESEND_API_KEY || 're_mock_placeholder_for_auth',
    })
  }
  return authInstance
}

const SESSION_COOKIE_NAMES = [
  'zolexora_app_suite_session',
  'zas_team_session',
  'zas_session',
]

function setSessionCookies(
  res: Response,
  req: Request,
  sessionToken: string,
  maxAgeSeconds = 30 * 24 * 60 * 60
) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https'
  const secureFlag = isHttps ? '; Secure' : ''

  const cookies = SESSION_COOKIE_NAMES.map(
    (name) =>
      `${name}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secureFlag}`
  )
  res.setHeader('Set-Cookie', cookies)
}

function clearSessionCookies(res: Response) {
  const cookies = SESSION_COOKIE_NAMES.map(
    (name) => `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  )
  res.setHeader('Set-Cookie', cookies)
}

function extractSessionToken(req: Request): string | null {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim()
  }
  if (req.query?.token && typeof req.query.token === 'string') {
    return req.query.token.trim()
  }
  if (req.headers.cookie) {
    for (const name of SESSION_COOKIE_NAMES) {
      const match = req.headers.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
      if (match?.[1]) {
        return decodeURIComponent(match[1].trim())
      }
    }
  }
  return null
}

interface SessionExchangePayload {
  idToken?: string
  id_token?: string
  user?: {
    uid?: string
    email?: string
    displayName?: string
    phoneNumber?: string
    phone_number?: string
    zolexora_id?: string
    [key: string]: any
  }
  zolexora_id?: string
}

async function handleSessionExchange(req: Request, res: Response) {
  try {
    const { idToken, id_token, user: bodyUser, zolexora_id } = req.body as SessionExchangePayload
    const token = idToken || id_token

    if (!token && !bodyUser?.uid && !bodyUser?.email) {
      return res.status(400).json({ error: 'idToken or user identity is required' })
    }

    const apiKey =
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
      process.env.FIREBASE_API_KEY ||
      process.env.NEXT_PUBLIC_APPSUITE_CLIENT_FIREBASE_API_KEY

    let verifiedEmail: string | undefined
    let verifiedName: string | undefined
    let verifiedPhone: string | undefined
    let verifiedUid: string | undefined

    // Verify token against Google Identity Toolkit if API key and token are present
    if (apiKey && token) {
      try {
        const verifyRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: token }),
          }
        )

        if (verifyRes.ok) {
          const verifyData = (await verifyRes.json()) as any
          const fbUser = verifyData.users?.[0]
          if (fbUser) {
            verifiedEmail = fbUser.email
            verifiedName = fbUser.displayName
            verifiedPhone = fbUser.phoneNumber
            verifiedUid = fbUser.localId
          }
        } else {
          console.warn('[Auth] Firebase token lookup response status:', verifyRes.status)
        }
      } catch (lookupErr) {
        console.warn('[Auth] Firebase token lookup fetch failed, falling back to payload:', lookupErr)
      }
    }

    // Determine normalized user email
    let email = (verifiedEmail || bodyUser?.email)?.trim().toLowerCase()
    if (!email) {
      const phone = verifiedPhone || bodyUser?.phoneNumber || bodyUser?.phone_number
      if (phone) {
        email = `${phone.replace(/[^0-9]/g, '')}@phone.zolexora.com`
      } else {
        const uid = verifiedUid || bodyUser?.uid
        if (uid) {
          email = `${uid}@firebase.zolexora.com`
        } else {
          return res.status(400).json({ error: 'User identity could not be resolved' })
        }
      }
    }

    // Determine Zolexora ID (ZX-XXXX-XXXX)
    let zxId =
      zolexora_id ||
      bodyUser?.zolexora_id ||
      (bodyUser?.displayName?.startsWith('ZX-') ? bodyUser.displayName : null) ||
      (verifiedName?.startsWith('ZX-') ? verifiedName : null)

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
    if (!dbUser) {
      return res.status(500).json({ error: 'Failed to record user in database' })
    }

    // Create secure 32-byte session token and store SHA-256 hash
    const sessionToken = crypto.randomBytes(32).toString('base64url')
    const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex')
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    await query(
      `INSERT INTO public.zolexora_auth_sessions (token_hash, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [tokenHash, dbUser.id, expiresAt]
    )

    // Set HTTP-only session cookies
    setSessionCookies(res, req, sessionToken)

    return res.json({
      success: true,
      sessionToken,
      session_token: sessionToken,
      user: {
        id: dbUser.id,
        zolexoraId: dbUser.zolexora_id,
        zolexora_id: dbUser.zolexora_id,
        email: dbUser.email,
        emailVerifiedAt: dbUser.email_verified_at,
        email_verified_at: dbUser.email_verified_at,
      },
      expiresAt: expiresAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
  } catch (error: unknown) {
    console.error('[Auth Session Error]:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Session establishment failed',
    })
  }
}

// POST /api/auth/session (Primary session exchange for Client and DevTeam auth cards)
authRouter.post('/session', handleSessionExchange)

// POST /api/auth/firebase (Backward compatibility with unified Firebase token exchange)
authRouter.post('/firebase', handleSessionExchange)

// GET /api/auth/session (Verify existing session from cookie or Authorization header)
authRouter.get('/session', async (req: Request, res: Response) => {
  try {
    const token = extractSessionToken(req)
    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const userResult = await query(
      `SELECT u.id, u.zolexora_id, u.email, u.email_verified_at
       FROM public.zolexora_auth_sessions s
       JOIN public.zolexora_auth_users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()
       LIMIT 1`,
      [tokenHash]
    )

    const dbUser = userResult.rows[0]
    if (!dbUser) {
      return res.status(401).json({ error: 'Invalid or expired session' })
    }

    res.json({
      user: {
        id: dbUser.id,
        zolexoraId: dbUser.zolexora_id,
        zolexora_id: dbUser.zolexora_id,
        email: dbUser.email,
        emailVerifiedAt: dbUser.email_verified_at,
        email_verified_at: dbUser.email_verified_at,
      },
    })
  } catch (error: unknown) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Session verification failed',
    })
  }
})

// POST /api/auth/sign-in
authRouter.post('/sign-in', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const result = await getAuth().signIn(email, password)
    setSessionCookies(res, req, result.sessionToken)

    res.json({
      success: true,
      user: result.user,
      sessionToken: result.sessionToken,
      session_token: result.sessionToken,
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

// Sign-out handler
async function handleSignOut(req: Request, res: Response) {
  try {
    const token = extractSessionToken(req)
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      await query(`DELETE FROM public.zolexora_auth_sessions WHERE token_hash = $1`, [tokenHash])
    }
    clearSessionCookies(res)
    res.json({ success: true, message: 'Signed out successfully' })
  } catch (error: unknown) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Sign out failed',
    })
  }
}

// POST /api/auth/sign-out
authRouter.post('/sign-out', handleSignOut)

// DELETE /api/auth/session
authRouter.delete('/session', handleSignOut)
