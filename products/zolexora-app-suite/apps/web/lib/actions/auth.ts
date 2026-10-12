'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getZolexoraAuth, SESSION_COOKIE_NAME } from '@/lib/auth'

export type AuthActionState = {
  error?: string
  success?: boolean
  email?: string // returned on signup so the "check email" screen knows who to address
}

// ── Sign In ────────────────────────────────────────────────────────────────
export async function signInAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = formData.get('email')?.toString().trim() ?? ''
  const password = formData.get('password')?.toString() ?? ''

  if (!email || !password) return { error: 'Email and password are required.' }

  let sessionToken: string
  let expiresAt: Date

  try {
    const result = await getZolexoraAuth().signIn(email, password)
    sessionToken = result.sessionToken
    expiresAt = result.expiresAt
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Sign in failed.' }
  }

  // Set HTTP-only session cookie — only reaches here on success
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })

  redirect('/dashboard')
}

// ── Sign Up ────────────────────────────────────────────────────────────────
export async function signUpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = formData.get('email')?.toString().trim() ?? ''
  const password = formData.get('password')?.toString() ?? ''
  const confirm = formData.get('confirm')?.toString() ?? ''

  if (!email || !password) return { error: 'Email and password are required.' }
  if (password !== confirm) return { error: 'Passwords do not match.' }

  try {
    await getZolexoraAuth().signUp(email, password)
    return { success: true, email }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Registration failed.' }
  }
}

// ── Sign Out ───────────────────────────────────────────────────────────────
export async function signOutAction(): Promise<never> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (token) {
    try { await getZolexoraAuth().signOut(token) } catch { /* ignore */ }
    cookieStore.delete(SESSION_COOKIE_NAME)
  }

  redirect('/')
}
