import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { generateContractLegalHtml } from '@/lib/contract-generator'
import { recordContractAuditEvent } from '@/lib/audit-logger'
import type { Contract } from '@/lib/types'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  const { data: contractData, error } = await supabase
    .from('contracts')
    .select('*, app_requests(title)')
    .eq('id', id)
    .eq('user_id', user.id)   // enforce ownership — users can only fetch their own contracts
    .single()

  if (error || !contractData) {
    return new NextResponse('Contract not found', { status: 404 })
  }

  const contract = contractData as Contract & { app_requests?: { title: string } }
  const clientName = user.email   // use real user email in the legal document
  const clientEmail = user.email
  const projectTitle = contract.app_requests?.title || contract.title

  const { html, documentHash } = generateContractLegalHtml({
    contract,
    clientName,
    clientEmail,
    projectTitle,
  })

  // Record Section 65B audit event
  await recordContractAuditEvent({
    contractId: contract.id,
    signerName: clientName,
    signerEmail: clientEmail,
    action: 'VIEWED',
    verificationMethod: 'SESSION_AUTH',
    documentHash,
  })

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Document-SHA256': documentHash,
    },
  })
}
