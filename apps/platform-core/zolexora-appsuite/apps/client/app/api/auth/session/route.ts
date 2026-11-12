import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'node:crypto'
import { query } from '@/lib/db'
import { SESSION_COOKIE_NAME } from '@/lib/auth-constants'
import { generateZolexoraId } from '@zolexora/user-auth-zolexora'

const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { idToken, user } = body

    if (!idToken) {
      return NextResponse.json({ error: 'idToken is required' }, { status: 400 })
    }

    // Resolve user email and canonical zolexoraId
    let email = user?.email?.trim().toLowerCase()
    let zolexoraId = user?.zolexora_id || user?.displayName?.startsWith('ZX-') ? user.displayName : null

    // If email is not directly available (e.g., phone login), generate fallback identifier
    if (!email) {
      const phone = user?.phoneNumber || user?.phone_number
      if (phone) {
        email = `${phone.replace(/[^0-9]/g, '')}@phone.zolexora.com`
      } else if (user?.uid) {
        email = `${user.uid}@firebase.zolexora.com`
      } else {
        return NextResponse.json({ error: 'User identity could not be resolved' }, { status: 400 })
      }
    }

    if (!zolexoraId) {
      zolexoraId = generateZolexoraId()
    }

    // Upsert user into public.zolexora_auth_users
    const userResult = await query<{
      id: string
      zolexora_id: string
      email: string
      email_verified_at: string | null
    }>(
      `INSERT INTO public.zolexora_auth_users (id, zolexora_id, email, password_hash, email_verified_at)
       VALUES (gen_random_uuid(), $1, $2, 'firebase-managed', now())
       ON CONFLICT (email) DO UPDATE 
         SET email_verified_at = COALESCE(public.zolexora_auth_users.email_verified_at, now())
       RETURNING id, zolexora_id, email, email_verified_at`,
      [zolexoraId, email]
    )

    const dbUser = userResult.rows[0]
    if (!dbUser) {
      return NextResponse.json({ error: 'Failed to record user in database' }, { status: 500 })
    }

    // Generate session token and store hash
    const sessionToken = crypto.randomBytes(32).toString('base64url')
    const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex')
    const expiresAt = new Date(Date.now() + DEFAULT_SESSION_TTL_MS)

    await query(
      `INSERT INTO public.zolexora_auth_sessions (token_hash, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [tokenHash, dbUser.id, expiresAt]
    )

    // Set HTTP-only session cookie
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    })

    return NextResponse.json({
      success: true,
      user: {
        id: dbUser.id,
        zolexoraId: dbUser.zolexora_id,
        email: dbUser.email,
        emailVerifiedAt: dbUser.email_verified_at,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Session initialization failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
