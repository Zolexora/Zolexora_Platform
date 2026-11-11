import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyAndParseEsignWebhook } from '@/lib/esign-gateway'
import { recordContractAuditEvent } from '@/lib/audit-logger'

/**
 * Public Webhook Endpoint — Digio / Leegality Aadhaar eSign callback.
 *
 * ⚠️  Intentionally has NO session cookie auth — this is called by Digio/Leegality
 * servers, not by users. Security is enforced by verifyAndParseEsignWebhook()
 * which validates the provider HMAC/signature on the raw payload.
 *
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

    // Update contract status to signed with Aadhaar eSign details in PostgreSQL
    await query(
      `UPDATE public.contracts
       SET status = $1, signing_mode = $2, signed_at = $3, document_url = $4, scope_summary = $5, updated_at = NOW()
       WHERE id = $6`,
      [
        'signed',
        'AADHAAR_ESIGN',
        details.completedAt,
        details.signedPdfUrl || null,
        `Executed via ${details.provider} Aadhaar eSign (Txn: ${details.txnId}, Aadhaar: ****${details.aadhaarLast4})`,
        contractId,
      ]
    )

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
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
