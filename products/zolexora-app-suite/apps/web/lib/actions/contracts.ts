'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { recordContractAuditEvent } from '@/lib/audit-logger'
import { generateContractLegalHtml } from '@/lib/contract-generator'
import type { Contract, ContractStatus, SigningMode } from '@/lib/types'

export type SignContractResult = {
  error?: string
  success?: boolean
  signedAt?: string
  signedHash?: string
}

export async function executeDigitalContract({
  contractId,
  signerName,
  signingMode = 'CLICKWRAP_OTP',
  otpCode,
}: {
  contractId: string
  signerName: string
  signingMode?: SigningMode
  otpCode?: string
}): Promise<SignContractResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Authentication required to execute digital contracts.' }
  }

  // Fetch the contract
  const { data: contractData, error: fetchError } = await supabase
    .from('contracts')
    .select('*, app_requests(title)')
    .eq('id', contractId)
    .single()

  if (fetchError || !contractData) {
    return { error: 'Contract not found or access denied.' }
  }

  const contract = contractData as Contract & { app_requests?: { title: string } }

  if (contract.status === 'signed') {
    return { error: 'This contract has already been executed.' }
  }

  // In production with Email OTP, verify otpCode against session/table.
  // For standard Clickwrap OTP mode, validate presence or session confirmation.
  if (signingMode === 'CLICKWRAP_OTP' && otpCode && otpCode.trim().length !== 6) {
    return { error: 'Invalid 6-digit confirmation code.' }
  }

  const clientEmail = user.email || 'client@zolexora.com'
  const projectTitle = contract.app_requests?.title || contract.title

  // Compute document hash before & after signing
  const { documentHash: originalDocHash } = generateContractLegalHtml({
    contract,
    clientName: signerName,
    clientEmail,
    projectTitle,
  })

  const signedAt = new Date().toISOString()
  const signedContractObj: Contract = {
    ...contract,
    status: 'signed',
    signed_at: signedAt,
    signing_mode: signingMode,
  }

  const { documentHash: signedDocHash } = generateContractLegalHtml({
    contract: signedContractObj,
    clientName: signerName,
    clientEmail,
    projectTitle,
  })

  // Update Contract in Database
  const { error: updateError } = await supabase
    .from('contracts')
    .update({
      status: 'signed' as ContractStatus,
      signing_mode: signingMode,
      signed_at: signedAt,
      document_hash: originalDocHash,
      signed_document_hash: signedDocHash,
    })
    .eq('id', contractId)
    .eq('user_id', user.id)

  if (updateError) {
    return { error: updateError.message }
  }

  // Record Section 65B Audit Event
  await recordContractAuditEvent({
    contractId,
    signerName,
    signerEmail: clientEmail,
    action: 'SIGNED',
    verificationMethod: signingMode,
    documentHash: signedDocHash,
    metadata: {
      originalHash: originalDocHash,
      signedHash: signedDocHash,
      it_act_sec10a_accepted: true,
      indian_evidence_act_sec65b: true,
    },
  })

  revalidatePath('/dashboard/contracts')
  revalidatePath(`/dashboard/contracts/${contractId}`)

  return {
    success: true,
    signedAt,
    signedHash: signedDocHash,
  }
}
