'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getZolexoraAuth, getCurrentUser, SESSION_COOKIE_NAME } from '@/lib/auth'
import { query } from '@/lib/db'
import type { RequestStatus, ContractType, SigningMode } from '@/lib/types'

export type AuthActionState = {
  error?: string
  success?: boolean
}

// ── Sign In ────────────────────────────────────────────────────────────────
export async function signInTeamAction(
  _prev: AuthActionState,
  formData: FormData
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

// ── Sign Out ───────────────────────────────────────────────────────────────
export async function signOutTeamAction(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (token) {
    try {
      await getZolexoraAuth().signOut(token)
    } catch {
      // Ignore cleanup error
    }
    cookieStore.delete(SESSION_COOKIE_NAME)
  }
  redirect('/login')
}

// ── Update Request Status ──────────────────────────────────────────────────
export async function updateRequestStatusAction(
  requestId: string,
  newStatus: RequestStatus
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  try {
    await query(
      `UPDATE public.app_requests
       SET status = $1, updated_at = NOW()
       WHERE id = $2`,
      [newStatus, requestId]
    )

    revalidatePath('/dashboard')
    revalidatePath('/requests')
    revalidatePath(`/requests/${requestId}`)
    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update request status',
    }
  }
}

// ── Create and Dispatch Contract ───────────────────────────────────────────
export async function createContractAction(
  _prev: { error?: string; success?: boolean },
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const requestId = formData.get('requestId')?.toString().trim() || null
  const userId = formData.get('userId')?.toString().trim()
  const title = formData.get('title')?.toString().trim()
  const contractType = (formData.get('contractType')?.toString() || 'MSA') as ContractType
  const totalValueInr = formData.get('totalValueInr')
    ? Number(formData.get('totalValueInr'))
    : null
  const scopeSummary = formData.get('scopeSummary')?.toString().trim() || null
  const stampState = formData.get('stampState')?.toString().trim() || 'Maharashtra'
  const stampDutyRef = formData.get('stampDutyRef')?.toString().trim() || null
  const signingMode = (formData.get('signingMode')?.toString() || 'CLICKWRAP_OTP') as SigningMode

  if (!userId) return { error: 'Client User ID is required.' }
  if (!title) return { error: 'Contract title is required.' }

  try {
    await query(
      `INSERT INTO public.contracts (
        request_id, user_id, title, contract_type, status,
        total_value_inr, scope_summary, stamp_state, stamp_duty_ref, signing_mode
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        requestId || null,
        userId,
        title,
        contractType,
        'sent', // Dispatched to client for review & execution
        totalValueInr,
        scopeSummary,
        stampState,
        stampDutyRef,
        signingMode,
      ]
    )

    // Advance request status to 'contracted' if linked
    if (requestId) {
      await query(
        `UPDATE public.app_requests SET status = 'contracted', updated_at = NOW() WHERE id = $1`,
        [requestId]
      )
    }

    revalidatePath('/dashboard')
    revalidatePath('/contracts')
    if (requestId) {
      revalidatePath(`/requests/${requestId}`)
    }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to create contract.' }
  }

  redirect('/contracts')
}
