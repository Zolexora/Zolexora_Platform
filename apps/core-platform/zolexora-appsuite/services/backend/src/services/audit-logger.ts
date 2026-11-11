import { query } from '../db.js'

export async function recordContractAuditEvent({
  contractId,
  userId,
  signerName,
  signerEmail,
  action,
  ipAddress,
  userAgent,
  verificationMethod,
  documentHash,
  metadata = {},
}: {
  contractId: string
  userId?: string | null
  signerName: string
  signerEmail: string
  action: string
  ipAddress: string
  userAgent: string
  verificationMethod: string
  documentHash?: string | null
  metadata?: Record<string, unknown>
}) {
  await query(
    `INSERT INTO public.contract_audit_logs 
     (contract_id, user_id, signer_name, signer_email, action, ip_address, user_agent, verification_method, document_hash_at_event, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      contractId,
      userId || null,
      signerName,
      signerEmail,
      action,
      ipAddress,
      userAgent,
      verificationMethod,
      documentHash || null,
      JSON.stringify(metadata),
    ]
  )
}
