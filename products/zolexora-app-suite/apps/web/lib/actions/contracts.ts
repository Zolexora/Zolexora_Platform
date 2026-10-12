'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { recordContractAuditEvent } from '@/lib/audit-logger'
import { generateContractLegalHtml } from '@/lib/contract-generator'
import { verifyIndianDscCertificate } from '@/lib/dsc-verifier'
import { initiateAadhaarEsignSession } from '@/lib/esign-gateway'
import type {
  Contract,
  ContractStatus,
  SigningMode,
  DscCertificateDetails,
  EsignProvider,
} from '@/lib/types'

export type SignContractResult = {
  error?: string
  success?: boolean
  signedAt?: string
  signedHash?: string
  gatewayUrl?: string
  documentId?: string
}

export async function executeDigitalContract({
  contractId,
  signerName,
  signingMode = 'CLICKWRAP_OTP',
  otpCode,
  dscPayload,
  esignProvider = 'DIGIO',
  signerPhone,
}: {
  contractId: string
  signerName: string
  signingMode?: SigningMode
  otpCode?: string
  dscPayload?: {
    certSubject: string
    certIssuer: string
    serialNumber: string
    rawSignaturePkcs7: string
    validFrom?: string
    validTo?: string
  }
  esignProvider?: EsignProvider
  signerPhone?: string
}): Promise<SignContractResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const clientEmail = user?.email || 'signatory@zolexora.com'

  // Fetch the contract
  const { data: contractData, error: fetchError } = await supabase
    .from('contracts')
    .select('*, app_requests(title)')
    .eq('id', contractId)
    .single()

  if (fetchError || !contractData) {
    return { error: 'Contract not found.' }
  }

  const contract = contractData as Contract & { app_requests?: { title: string } }

  if (contract.status === 'signed') {
    return { error: 'This contract has already been executed.' }
  }

  const projectTitle = contract.app_requests?.title || contract.title

  // Compute pre-signature document hash
  const { documentHash: originalDocHash } = generateContractLegalHtml({
    contract,
    clientName: signerName,
    clientEmail,
    projectTitle,
  })

  // 1. MODE: AADHAAR eSign (Digio / Leegality)
  if (signingMode === 'AADHAAR_ESIGN') {
    const session = await initiateAadhaarEsignSession({
      contractId,
      signerName,
      signerContact: signerPhone || clientEmail,
      documentHash: originalDocHash,
      provider: esignProvider,
    })

    if (!session.success) {
      return { error: session.error || 'Failed to initiate Aadhaar eSign session.' }
    }

    // Record Audit Event: ESIGN_INITIATED
    await recordContractAuditEvent({
      contractId,
      signerName,
      signerEmail: clientEmail,
      action: 'ESIGN_INITIATED',
      verificationMethod: `${esignProvider}_GATEWAY_DISPATCH`,
      documentHash: originalDocHash,
      metadata: {
        provider: esignProvider,
        documentId: session.documentId,
        signerContact: signerPhone || clientEmail,
      },
    })

    return {
      success: true,
      gatewayUrl: session.gatewayUrl,
      documentId: session.documentId,
    }
  }

  let verifiedDscDetails: DscCertificateDetails | null = null

  // 2. MODE: CLASS 3 USB DSC TOKEN
  if (signingMode === 'DSC_TOKEN') {
    if (!dscPayload) {
      return { error: 'No hardware cryptographic token signature provided.' }
    }

    const dscVerification = verifyIndianDscCertificate(dscPayload)
    if (!dscVerification.isValid || !dscVerification.certificateDetails) {
      return { error: dscVerification.error || 'DSC token verification failed.' }
    }
    verifiedDscDetails = dscVerification.certificateDetails
  } else if (signingMode === 'CLICKWRAP_OTP') {
    // 3. MODE: EMAIL OTP / CLICKWRAP
    if (otpCode && otpCode.trim().length !== 6) {
      return { error: 'Invalid 6-digit confirmation code.' }
    }
  }

  const signedAt = new Date().toISOString()
  const signedContractObj: Contract = {
    ...contract,
    status: 'signed',
    signed_at: signedAt,
    signing_mode: signingMode,
    dsc_details: verifiedDscDetails,
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
      scope_summary: verifiedDscDetails
        ? `Signed via Class 3 USB DSC Token (Serial: ${verifiedDscDetails.serialNumber}, CA: ${verifiedDscDetails.certIssuer})`
        : contract.scope_summary,
    })
    .eq('id', contractId)

  if (updateError) {
    return { error: updateError.message }
  }

  // Record Section 65B Audit Event
  await recordContractAuditEvent({
    contractId,
    signerName,
    signerEmail: clientEmail,
    action: signingMode === 'DSC_TOKEN' ? 'DSC_VERIFIED' : 'SIGNED',
    verificationMethod: signingMode,
    documentHash: signedDocHash,
    metadata: {
      originalHash: originalDocHash,
      signedHash: signedDocHash,
      it_act_sec10a_accepted: true,
      indian_evidence_act_sec65b: true,
      cca_dsc_verified: signingMode === 'DSC_TOKEN',
      dsc_details: verifiedDscDetails || undefined,
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
