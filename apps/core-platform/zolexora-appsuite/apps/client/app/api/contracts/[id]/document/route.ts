import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
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

  const { rows } = await query(
    `SELECT c.*, r.title AS app_request_title
     FROM public.contracts c
     LEFT JOIN public.app_requests r ON c.request_id = r.id
     WHERE c.id = $1 AND c.user_id = $2
     LIMIT 1`,
    [id, user.id]
  )

  const contractData = rows[0]
  if (!contractData) {
    return new NextResponse('Contract not found', { status: 404 })
  }

  const contract = {
    ...contractData,
    app_requests: contractData.app_request_title ? { title: contractData.app_request_title } : undefined,
  } as Contract & { app_requests?: { title: string } }

  const clientName = user.email
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
