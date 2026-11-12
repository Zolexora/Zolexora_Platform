import { createHash } from 'crypto'
import { headers } from 'next/headers'
import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
import type { AuditAction } from '@/lib/types'

export function computeSHA256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

export interface ClientConnectionInfo {
  ipAddress: string
  userAgent: string
}

export async function getClientConnectionInfo(): Promise<ClientConnectionInfo> {
  const headerStore = await headers()
  const forwarded = headerStore.get('x-forwarded-for')
  const realIp = headerStore.get('x-real-ip')
  const ipAddress = forwarded ? forwarded.split(',')[0].trim() : (realIp || '127.0.0.1')
  const userAgent = headerStore.get('user-agent') || 'Unknown User-Agent'
  return { ipAddress, userAgent }
}

export async function recordContractAuditEvent({
  contractId,
  signerName,
  signerEmail,
  action,
  verificationMethod,
  documentHash,
  metadata = {},
}: {
  contractId: string
  signerName: string
  signerEmail: string
  action: AuditAction
  verificationMethod: string
  documentHash?: string
  metadata?: Record<string, unknown>
}) {
  const user = await getCurrentUser()
  const { ipAddress, userAgent } = await getClientConnectionInfo()

  await query(
    `INSERT INTO public.contract_audit_logs 
     (contract_id, user_id, signer_name, signer_email, action, ip_address, user_agent, verification_method, document_hash_at_event, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      contractId,
      user?.id || null,
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

