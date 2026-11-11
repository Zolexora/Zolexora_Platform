'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
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
  const user = await getCurrentUser()
  const clientEmail = user?.email || 'signatory@zolexora.com'

  // Fetch the contract
  const { rows: contractRows } = await query(
    `SELECT c.*, r.title AS app_request_title
     FROM public.contracts c
     LEFT JOIN public.app_requests r ON c.request_id = r.id
     WHERE c.id = $1 LIMIT 1`,
    [contractId]
  )

  if (!contractRows[0]) {
    return { error: 'Contract not found.' }
  }

  const contract = {
    ...contractRows[0],
    app_requests: contractRows[0].app_request_title ? { title: contractRows[0].app_request_title } : undefined,
  } as Contract & { app_requests?: { title: string } }


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
  try {
    await query(
      `UPDATE public.contracts
       SET status = $1, signing_mode = $2, signed_at = $3, document_hash = $4, signed_document_hash = $5, scope_summary = $6, updated_at = NOW()
       WHERE id = $7`,
      [
        'signed',
        signingMode,
        signedAt,
        originalDocHash,
        signedDocHash,
        verifiedDscDetails
          ? `Signed via Class 3 USB DSC Token (Serial: ${verifiedDscDetails.serialNumber}, CA: ${verifiedDscDetails.certIssuer})`
          : contract.scope_summary,
        contractId,
      ]
    )
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to update contract' }
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
