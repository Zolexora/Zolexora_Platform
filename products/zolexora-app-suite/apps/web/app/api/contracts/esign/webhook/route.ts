import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyAndParseEsignWebhook } from '@/lib/esign-gateway'
import { recordContractAuditEvent } from '@/lib/audit-logger'
import type { ContractStatus } from '@/lib/types'

/**
 * Public Webhook Endpoint for Digio and Leegality
 * POST /api/contracts/esign/webhook
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.json()
    const { isValid, details, error } = verifyAndParseEsignWebhook(rawBody)

    if (!isValid || !details) {
      return NextResponse.json({ error: error || 'Invalid webhook event' }, { status: 400 })
    }

    // Extract contract ID from custom tag or query param
    const url = new URL(request.url)
    const contractId = url.searchParams.get('contract_id') || rawBody.contract_id || rawBody.custom_id

    if (!contractId) {
      return NextResponse.json(
        { error: 'Missing contract_id in webhook query or payload' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Update contract status to signed with Aadhaar eSign details
    const { error: dbError } = await supabase
      .from('contracts')
      .update({
        status: 'signed' as ContractStatus,
        signing_mode: 'AADHAAR_ESIGN',
        signed_at: details.completedAt,
        document_url: details.signedPdfUrl || null,
        scope_summary: `Executed via ${details.provider} Aadhaar eSign (Txn: ${details.txnId}, Aadhaar: ****${details.aadhaarLast4})`,
      })
      .eq('id', contractId)

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    // Log Section 65B Audit Trail
    await recordContractAuditEvent({
      contractId,
      signerName: details.signerName,
      signerEmail: details.signerContact,
      action: 'ESIGN_WEBHOOK_RECEIVED',
      verificationMethod: `${details.provider}_AADHAAR_OTP`,
      metadata: {
        provider: details.provider,
        txnId: details.txnId,
        aadhaarLast4: details.aadhaarLast4,
        it_act_sec3a: true,
        sec65b_admissible: true,
      },
    })

    return NextResponse.json({ success: true, txnId: details.txnId })
  } catch {
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
