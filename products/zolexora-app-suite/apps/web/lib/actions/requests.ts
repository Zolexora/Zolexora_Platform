'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
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
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const userId = user?.id || '00000000-0000-0000-0000-000000000000'

  const title = formData.get('title')?.toString().trim()
  const category = formData.get('category')?.toString().trim() || null
  const description = formData.get('description')?.toString().trim()
  const features = formData.get('features')?.toString().trim()
  const budget_range = formData.get('budget_range')?.toString().trim() || null
  const timeline = formData.get('timeline')?.toString().trim() || null

  if (!title) {
    return { error: 'Project title is required.' }
  }
  if (!description) {
    return { error: 'Project description is required.' }
  }

  const detailedDescription = features
    ? `${description}\n\nKey Features & Requirements:\n${features}${timeline ? `\n\nTarget Timeline: ${timeline}` : ''}`
    : `${description}${timeline ? `\n\nTarget Timeline: ${timeline}` : ''}`

  const { error } = await supabase.from('app_requests').insert({
    user_id: userId,
    title,
    category,
    description: detailedDescription,
    budget_range,
    status: 'submitted' as RequestStatus,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/requests')
  redirect('/dashboard/requests')
}
