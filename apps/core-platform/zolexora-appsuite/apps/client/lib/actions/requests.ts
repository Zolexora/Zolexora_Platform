'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
import type { RequestStatus } from '@/lib/types'

export type CreateRequestState = {
  error?: string
  success?: boolean
}

export async function createApplicationRequest(
  prevState: CreateRequestState,
  formData: FormData
): Promise<CreateRequestState> {
  // Auth: use Zolexora session
  const user = await getCurrentUser()
  if (!user) return { error: 'You must be signed in to submit a request.' }

  const title = formData.get('title')?.toString().trim()
  const category = formData.get('category')?.toString().trim() || null
  const description = formData.get('description')?.toString().trim()
  const features = formData.get('features')?.toString().trim()
  const budget_range = formData.get('budget_range')?.toString().trim() || null
  const timeline = formData.get('timeline')?.toString().trim() || null

  if (!title) return { error: 'Project title is required.' }
  if (!description) return { error: 'Project description is required.' }

  const detailedDescription = features
    ? `${description}\n\nKey Features & Requirements:\n${features}${timeline ? `\n\nTarget Timeline: ${timeline}` : ''}`
    : `${description}${timeline ? `\n\nTarget Timeline: ${timeline}` : ''}`

  try {
    await query(
      `INSERT INTO public.app_requests (user_id, title, category, description, budget_range, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [user.id, title, category, detailedDescription, budget_range, 'submitted']
    )
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to create request' }
  }


  revalidatePath('/dashboard')
  revalidatePath('/dashboard/requests')
  redirect('/dashboard/requests')
}
