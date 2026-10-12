import { INDIAN_LEGAL_CLAUSES } from '@/lib/legal-clauses'
import { computeSHA256 } from '@/lib/audit-logger'
import type { Contract } from '@/lib/types'

export interface LegalDocumentTemplateProps {
  contract: Contract
  clientName: string
  clientEmail: string
  projectTitle: string
}

export function generateContractLegalHtml({
  contract,
  clientName,
  clientEmail,
  projectTitle,
}: LegalDocumentTemplateProps): { html: string; documentHash: string } {
  const clauses = INDIAN_LEGAL_CLAUSES[contract.contract_type] || INDIAN_LEGAL_CLAUSES.MSA
  const executionDate = new Date(contract.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const clausesHtml = clauses
    .map(
      (c) => `
    <div style="margin-bottom: 20px;">
      <h3 style="font-size: 15px; color: #1e293b; margin-bottom: 6px;">${c.title}</h3>
      <p style="font-size: 13px; line-height: 1.6; color: #334155; margin: 0; text-align: justify;">${c.content}</p>
    </div>
  `
    )
    .join('')

  const isSigned = contract.status === 'signed'
  const signedDate = contract.signed_at
    ? new Date(contract.signed_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    : null

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${contract.title}</title>
  <style>
    @page { size: A4; margin: 25mm 20mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; }
    .header { border-bottom: 2px solid #6366f1; padding-bottom: 16px; margin-bottom: 24px; }
    .stamp-box { border: 1px dashed #64748b; background: #f8fafc; padding: 10px; font-size: 11px; color: #475569; margin-bottom: 20px; border-radius: 4px; }
    .parties { display: flex; justify-content: space-between; margin-bottom: 24px; padding: 12px; background: #f1f5f9; border-radius: 6px; }
    .party-col { width: 48%; font-size: 13px; line-height: 1.5; }
    .signature-grid { margin-top: 40px; display: flex; justify-content: space-between; border-top: 1px solid #cbd5e1; padding-top: 24px; }
    .sig-box { width: 45%; border: 1px solid #e2e8f0; padding: 16px; border-radius: 6px; font-size: 12px; }
    .signed-badge { color: #15803d; font-weight: bold; background: #dcfce7; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-top: 8px; }
    .sec65b { margin-top: 30px; font-size: 10px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div style="font-size: 20px; font-weight: bold; color: #4338ca; text-transform: uppercase;">Zolexora App Suite</div>
    <div style="font-size: 12px; color: #64748b;">Software Development & Intellectual Property Services</div>
    <h1 style="font-size: 22px; margin: 16px 0 4px 0; color: #0f172a;">${contract.title}</h1>
    <div style="font-size: 12px; color: #64748b;">Contract Ref ID: ${contract.id} · Date of Issue: ${executionDate}</div>
  </div>

  <div class="stamp-box">
    <strong>INDIAN STAMP ACT COMPLIANCE NOTICE:</strong><br />
    State of Execution: ${contract.stamp_state || 'MAHARASHTRA'} · e-Stamp Ref: ${contract.stamp_duty_ref || 'PENDING_ADHESIVE_DUTY'} · Mode: ${contract.signing_mode}
  </div>

  <div class="parties">
    <div class="party-col">
      <strong>DEVELOPER / SERVICE PROVIDER:</strong><br />
      <strong>Zolexora Tech Team</strong><br />
      Dedicated On-Demand Application Engineering Unit<br />
      Email: support@zolexora.com
    </div>
    <div class="party-col">
      <strong>CLIENT / RECIPIENT:</strong><br />
      <strong>${clientName}</strong><br />
      Email: ${clientEmail}<br />
      Project Scope: ${projectTitle}
    </div>
  </div>

  <div style="margin-bottom: 24px;">
    <h3 style="font-size: 14px; text-transform: uppercase; color: #475569; letter-spacing: 0.05em;">Commercials & Value</h3>
    <p style="font-size: 13px; margin: 4px 0;"><strong>Agreed Consideration:</strong> ${contract.total_value_inr ? `₹${Number(contract.total_value_inr).toLocaleString('en-IN')}` : 'As specified in milestone schedule'}</p>
    ${contract.scope_summary ? `<p style="font-size: 13px; margin: 4px 0;"><strong>Scope Summary:</strong> ${contract.scope_summary}</p>` : ''}
  </div>

  <div class="clauses">
    ${clausesHtml}
  </div>

  <div class="signature-grid">
    <div class="sig-box">
      <strong>For Zolexora Platform:</strong><br /><br />
      <em>Authorized Digital Signatory</em><br />
      Zolexora Engineering Operations<br />
      Status: <span style="color: #4338ca; font-weight: bold;">Digitally Issued</span>
    </div>
    <div class="sig-box">
      <strong>For Client (${clientName}):</strong><br /><br />
      ${
        isSigned
          ? `<span class="signed-badge">✓ DIGITALLY SIGNED</span><br />
             Timestamp: ${signedDate} IST<br />
             Signer Email: ${clientEmail}<br />
             Mode: ${contract.signing_mode}`
          : `<span style="color: #b45309; font-weight: bold;">AWAITING CLIENT EXECUTION</span><br />
             Sign electronically via Zolexora App Suite Portal`
      }
    </div>
  </div>

  <div class="sec65b">
    Digitally generated and cryptographically verifiable document pursuant to Section 10A of the Information Technology Act, 2000.<br />
    Audit Trail Certificate admissible under Section 65B of the Indian Evidence Act, 1872.
  </div>
</body>
</html>`

  const documentHash = computeSHA256(html)
  return { html, documentHash }
}
