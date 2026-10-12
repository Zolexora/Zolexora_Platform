import { createHash } from 'crypto'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
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
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { ipAddress, userAgent } = await getClientConnectionInfo()

  await supabase.from('contract_audit_logs').insert({
    contract_id: contractId,
    user_id: user?.id || null,
    signer_name: signerName,
    signer_email: signerEmail,
    action,
    ip_address: ipAddress,
    user_agent: userAgent,
    verification_method: verificationMethod,
    document_hash_at_event: documentHash || null,
    metadata,
  })
}
