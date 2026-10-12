'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ContractStatus } from '@/lib/types'

export type UpdateContractState = {
  error?: string
  success?: boolean
}

export async function signContract(
  contractId: string
): Promise<UpdateContractState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('contracts')
    .update({
      status: 'signed' as ContractStatus,
      signed_at: new Date().toISOString(),
    })
    .eq('id', contractId)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/contracts')
  revalidatePath(`/dashboard/contracts/${contractId}`)
  return { success: true }
}
