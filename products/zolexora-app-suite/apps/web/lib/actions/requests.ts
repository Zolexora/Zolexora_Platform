'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { RequestStatus } from '@/lib/types'

export type CreateRequestState = {
  error?: string
  success?: boolean
}

export async function createApplicationRequest(
  prevState: CreateRequestState,
  formData: FormData
): Promise<CreateRequestState> {
  // Auth: use Zolexora session — not Supabase auth
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

  const supabase = await createClient()
  const { error } = await supabase.from('app_requests').insert({
    user_id: user.id,  // Zolexora auth user UUID
    title,
    category,
    description: detailedDescription,
    budget_range,
    status: 'submitted' as RequestStatus,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/requests')
  redirect('/dashboard/requests')
}
