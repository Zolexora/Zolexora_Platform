import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateContractLegalHtml } from '@/lib/contract-generator'
import { recordContractAuditEvent } from '@/lib/audit-logger'
import type { Contract } from '@/lib/types'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { data: contractData, error } = await supabase
    .from('contracts')
    .select('*, app_requests(title)')
    .eq('id', id)
    .single()

  if (error || !contractData) {
    return new NextResponse('Contract not found', { status: 404 })
  }

  const contract = contractData as Contract & { app_requests?: { title: string } }
  const clientName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Client'
  const clientEmail = user.email || 'client@example.com'
  const projectTitle = contract.app_requests?.title || contract.title

  const { html, documentHash } = generateContractLegalHtml({
    contract,
    clientName,
    clientEmail,
    projectTitle,
  })

  // Record audit event for document download/print view
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
