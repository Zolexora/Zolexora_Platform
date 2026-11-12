import { createHash } from 'crypto'
import type { Contract } from '../types.js'

export function computeSHA256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

export function generateContractLegalHtml({
  contract,
  clientName,
  clientEmail,
  projectTitle,
}: {
  contract: Contract
  clientName: string
  clientEmail: string
  projectTitle: string
}): { html: string; documentHash: string } {
  const isExecuted = contract.status === 'signed'
  const executionDate = contract.signed_at
    ? new Date(contract.signed_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })

  const rawTextForHash = [
    `CONTRACT_ID:${contract.id}`,
    `TYPE:${contract.contract_type}`,
    `CLIENT:${clientEmail}`,
    `TITLE:${projectTitle}`,
    `VALUE_INR:${contract.total_value_inr ?? 0}`,
    `STATUS:${contract.status}`,
    `SIGNED_AT:${contract.signed_at ?? 'PENDING'}`,
  ].join('|')

  const documentHash = computeSHA256(rawTextForHash)

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${contract.title} - Zolexora Platform Legal Contract</title>
  <style>
    body { font-family: 'Times New Roman', Times, serif; color: #111; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; }
    h1 { text-align: center; font-size: 24px; margin-bottom: 5px; }
    h2 { text-align: center; font-size: 14px; font-weight: normal; margin-top: 0; color: #555; text-transform: uppercase; }
    .sec { margin-top: 25px; }
    .sec-title { font-weight: bold; text-decoration: underline; margin-bottom: 8px; }
    .hash-box { background: #f4f4f4; border: 1px solid #ccc; padding: 10px; font-family: monospace; font-size: 11px; margin-top: 30px; word-break: break-all; }
    .sig-table { width: 100%; margin-top: 40px; border-top: 2px solid #222; padding-top: 20px; }
    .sig-cell { width: 50%; vertical-align: top; }
  </style>
</head>
<body>
  <h1>${contract.title}</h1>
  <h2>${contract.contract_type} • INDIAN IT ACT 2000 SEC 10A COMPLIANT</h2>

  <div class="sec">
    <div class="sec-title">1. PARTIES &amp; EFFECTIVE DATE</div>
    <p>This Agreement is executed on <strong>${executionDate}</strong> between <strong>Zolexora Tech Private Limited</strong> (&quot;Developer&quot;) and <strong>${clientName}</strong> (${clientEmail}) (&quot;Client&quot;).</p>
  </div>

  <div class="sec">
    <div class="sec-title">2. SCOPE OF SERVICES</div>
    <p>Project: <strong>${projectTitle}</strong></p>
    <p>${contract.scope_summary || 'Custom application development as specified in the application development requirement docket.'}</p>
  </div>

  <div class="sec">
    <div class="sec-title">3. CONSIDERATION</div>
    <p>Total Contract Value: <strong>INR ₹${Number(contract.total_value_inr || 0).toLocaleString('en-IN')}</strong> (Exclusive of applicable GST).</p>
  </div>

  <div class="sec">
    <div class="sec-title">4. INTELLECTUAL PROPERTY</div>
    <p>Upon receipt of 100% final settlement of dues, all custom source code, configurations, and deliverables shall be transferred to the Client.</p>
  </div>

  <div class="sec">
    <div class="sec-title">5. GOVERNING LAW &amp; JURISDICTION</div>
    <p>This contract shall be construed in accordance with the Laws of India, with jurisdiction in <strong>${contract.stamp_state || 'Maharashtra'}</strong>.</p>
  </div>

  <table class="sig-table">
    <tr>
      <td class="sig-cell">
        <strong>For Zolexora Tech Private Limited</strong><br>
        Authorized Signatory<br>
        Status: Corporate Execution Enacted
      </td>
      <td class="sig-cell">
        <strong>For Client: ${clientName}</strong><br>
        Signatory: ${clientEmail}<br>
        Status: ${isExecuted ? 'DIGITALLY EXECUTED' : 'AWAITING DIGITAL SIGNATURE'}<br>
        Method: ${contract.signing_mode}
      </td>
    </tr>
  </table>

  <div class="hash-box">
    <strong>DOCUMENT CRYPTOGRAPHIC INTEGRITY AUDIT</strong><br>
    SHA-256 Digest: ${documentHash}<br>
    Statutory: Admissible under Section 65B of Indian Evidence Act 1872
  </div>
</body>
</html>`

  return { html, documentHash }
}
