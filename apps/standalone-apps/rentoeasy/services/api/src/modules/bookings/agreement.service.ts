import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'

export interface AgreementParties {
  owner: {
    name: string
    address: string
    aadhaarLastFour?: string
    phone: string
  }
  tenant: {
    name: string
    permanentAddress: string
    phone: string
    aadhaarLastFour?: string
  }
}

export interface AgreementDetails {
  propertyAddress: string
  propertyCity: string
  propertyState: string
  monthlyRent: number
  securityDeposit: number
  moveInDate: string
  durationMonths: number
  rules?: string
}

@Injectable()
export class AgreementService {
  private readonly logger = new Logger(AgreementService.name)

  private get digioBase() {
    return this.config.get('DIGIO_ENV') === 'production'
      ? 'https://api.digio.in'
      : 'https://ext.digio.in:444'
  }

  private get digioAuth() {
    const id     = this.config.get('DIGIO_CLIENT_ID')
    const secret = this.config.get('DIGIO_CLIENT_SECRET')
    return Buffer.from(`${id}:${secret}`).toString('base64')
  }

  constructor(private config: ConfigService) {}

  // ─── GENERATE + SEND FOR ESIGN ───────────────────────────────────────────────
  // Creates a Digio eSign request with the rent agreement template.
  // Both parties sign via OTP on their registered phone numbers.

  async createESignRequest(
    bookingId: string,
    parties: AgreementParties,
    details: AgreementDetails,
  ): Promise<{ requestId: string; signingUrl: { owner: string; tenant: string } }> {
    const htmlContent = this.buildAgreementHTML(parties, details)

    try {
      const res = await axios.post(
        `${this.digioBase}/client/signing/request`,
        {
          signers: [
            {
              identifier:   `91${parties.owner.phone}`,
              name:         parties.owner.name,
              sign_type:    'aadhaar',   // Aadhaar OTP eSign — legally strongest
              reason:       'Lessor signature on Rent Agreement',
            },
            {
              identifier:   `91${parties.tenant.phone}`,
              name:         parties.tenant.name,
              sign_type:    'electronic', // Phone OTP — still legally valid
              reason:       'Lessee signature on Rent Agreement',
            },
          ],
          display_on_page: '1',
          send_sign_link:  false,    // we show the link in-app
          expire_in_days:  7,
          file_name:       `RentAgreement_${bookingId}.html`,
          file_type:       'html',
          file_data:       Buffer.from(htmlContent).toString('base64'),
          message:         'Please sign your Rent Agreement for your booking on Rent & Stay',
          customer_identifier: bookingId,
        },
        {
          headers: { Authorization: `Basic ${this.digioAuth}` },
          timeout: 20000,
        },
      )

      const { id: requestId, signing_parties } = res.data

      // Extract individual signing URLs for owner and tenant
      const ownerParty  = signing_parties?.find((p: any) => p.identifier === `91${parties.owner.phone}`)
      const tenantParty = signing_parties?.find((p: any) => p.identifier === `91${parties.tenant.phone}`)

      return {
        requestId,
        signingUrl: {
          owner:  ownerParty?.signing_url  ?? '',
          tenant: tenantParty?.signing_url ?? '',
        },
      }
    } catch (err: any) {
      this.logger.error(`Digio eSign request failed: ${JSON.stringify(err?.response?.data)}`)
      throw new Error('Could not create agreement signing request. Please try again.')
    }
  }

  // ─── BUILD AGREEMENT HTML ────────────────────────────────────────────────────

  private buildAgreementHTML(parties: AgreementParties, details: AgreementDetails): string {
    const { owner, tenant } = parties
    const moveIn  = new Date(details.moveInDate).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
    const moveOut = new Date(
      new Date(details.moveInDate).setMonth(
        new Date(details.moveInDate).getMonth() + details.durationMonths,
      ),
    ).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

    const rentWords = this.numberToWords(details.monthlyRent)
    const depWords  = this.numberToWords(details.securityDeposit)
    const today     = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Times New Roman', serif; font-size: 13px; line-height: 1.8; color: #000; margin: 40px; }
    h1 { text-align: center; font-size: 18px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
    h2 { font-size: 14px; margin: 20px 0 8px; text-decoration: underline; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .clause { margin: 10px 0; }
    .parties { margin: 20px 0; border: 1px solid #000; padding: 12px; }
    .signature-block { display: flex; justify-content: space-between; margin-top: 60px; }
    .sig-box { width: 45%; border-top: 1px solid #000; padding-top: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    td, th { border: 1px solid #000; padding: 6px 10px; }
    th { background: #f0f0f0; }
    .stamp { border: 2px solid #000; padding: 10px; text-align: center; margin: 20px auto; width: 200px; font-size: 11px; }
  </style>
</head>
<body>

<h1>Rent Agreement</h1>
<p class="center">(Leave and Licence Agreement)</p>
<p class="center bold">This agreement is executed on <span class="bold">${today}</span></p>

<div class="parties">
  <h2>Parties to the Agreement</h2>
  <p><span class="bold">LICENSOR (Owner / Lessor):</span><br>
  ${owner.name}, residing at ${owner.address},
  ${owner.aadhaarLastFour ? `Aadhaar ending in ${owner.aadhaarLastFour}` : ''},
  Contact: ${owner.phone}</p>
  <br>
  <p><span class="bold">LICENSEE (Tenant / Lessee):</span><br>
  ${tenant.name}, residing at ${tenant.permanentAddress},
  ${tenant.aadhaarLastFour ? `Aadhaar ending in ${tenant.aadhaarLastFour}` : ''},
  Contact: ${tenant.phone}</p>
</div>

<h2>1. Property Details</h2>
<p>The Licensor hereby grants to the Licensee the right to use and occupy the premises situated at:
<span class="bold">${details.propertyAddress}, ${details.propertyCity}, ${details.propertyState}</span>
(hereinafter referred to as "the Premises").</p>

<h2>2. Term</h2>
<table>
  <tr><th>Move-In Date</th><th>Term</th><th>Move-Out Date</th></tr>
  <tr><td>${moveIn}</td><td>${details.durationMonths} Months</td><td>${moveOut}</td></tr>
</table>
<p>This agreement shall be renewed or vacated upon mutual consent before the expiry date.</p>

<h2>3. Rent & Deposit</h2>
<table>
  <tr><th>Monthly Licence Fee (Rent)</th><td>₹${details.monthlyRent.toLocaleString('en-IN')} (Rupees ${rentWords} only)</td></tr>
  <tr><th>Security Deposit</th><td>₹${details.securityDeposit.toLocaleString('en-IN')} (Rupees ${depWords} only)</td></tr>
  <tr><th>Rent Due Date</th><td>1st of every calendar month</td></tr>
  <tr><th>Payment Mode</th><td>Online via Rent & Stay platform</td></tr>
</table>

<h2>4. Terms & Conditions</h2>
<div class="clause">4.1 The Licensee shall use the Premises only for residential purposes and not for any commercial, illegal, or immoral activity.</div>
<div class="clause">4.2 The Licensee shall not sublet, assign or transfer the Premises or any part thereof to any third party without the written consent of the Licensor.</div>
<div class="clause">4.3 The Licensee shall maintain the Premises in good condition and shall be responsible for any damage caused by negligence.</div>
<div class="clause">4.4 The Licensor shall be responsible for major structural repairs. The Licensee shall handle minor maintenance issues.</div>
<div class="clause">4.5 The security deposit shall be refunded within 15 days of vacating the Premises, after deducting any dues or damages.</div>
<div class="clause">4.6 Either party may terminate this agreement with 30 days written notice.</div>
<div class="clause">4.7 The Licensee shall submit to police verification as required under applicable state laws. The Licensor is responsible for initiating this process.</div>
${details.rules ? `<div class="clause">4.8 <span class="bold">Additional House Rules:</span> ${details.rules}</div>` : ''}

<h2>5. Platform</h2>
<p>This agreement is facilitated by <span class="bold">Rent & Stay</span> (www.rentandstay.in).
All rent payments shall be made through the Rent & Stay platform.
The platform acts solely as an intermediary and is not a party to this agreement.</p>

<h2>6. Dispute Resolution</h2>
<p>Any dispute arising out of this agreement shall be resolved through mutual discussion. If unresolved,
it shall be referred to arbitration under the Arbitration and Conciliation Act, 1996, at ${details.propertyCity}.</p>

<h2>7. Governing Law</h2>
<p>This agreement shall be governed by the laws of India and the state of ${details.propertyState}.</p>

<p style="margin-top:30px">Both parties have read, understood and agreed to all the terms and conditions mentioned above and sign this agreement in good faith.</p>

<div class="signature-block">
  <div class="sig-box">
    <strong>Licensor (Owner)</strong><br>
    ${owner.name}<br>
    Date: ___________
  </div>
  <div class="sig-box">
    <strong>Licensee (Tenant)</strong><br>
    ${tenant.name}<br>
    Date: ___________
  </div>
</div>

<div style="margin-top:40px;font-size:11px;color:#555;text-align:center">
  This document has been digitally signed via Digio (www.digio.in) and is legally valid under
  the Information Technology Act, 2000 and the Indian Contract Act, 1872.
</div>

</body>
</html>`
  }

  // ─── POLICE VERIFICATION FORM DATA ──────────────────────────────────────────
  // Pre-fills all fields using booking + tenant + property data.
  // Owner just reviews and submits to their state portal.

  buildPoliceVerificationData(data: {
    owner:    { name: string; phone: string; address: string }
    tenant:   { name: string; phone: string; permanentAddress: string; aadhaarLastFour?: string; photo?: string }
    property: { address: string; city: string; state: string; pincode: string }
    booking:  { moveInDate: string; monthlyRent: number }
  }) {
    const state = data.property.state.toLowerCase()

    // State-specific portal URLs
    const portalUrls: Record<string, string> = {
      delhi:       'https://www.delhipolice.gov.in/tenant-verification',
      maharashtra: 'https://tenantverification.maharashtrapolice.gov.in',
      karnataka:   'https://tenantverification.ksp.gov.in',
      'uttar pradesh': 'https://uppolice.gov.in/pages/en/tenant-verification',
      telangana:   'https://tgpolice.gov.in/tenant-verification',
    }

    const matchedState = Object.keys(portalUrls).find((s) => state.includes(s))
    const portalUrl    = matchedState ? portalUrls[matchedState] : null

    return {
      portalUrl,
      stateSupported: !!portalUrl,
      prefilled: {
        // Owner (Landlord) details
        landlord_name:        data.owner.name,
        landlord_phone:       data.owner.phone,
        landlord_address:     data.owner.address,

        // Tenant details
        tenant_name:          data.tenant.name,
        tenant_phone:         data.tenant.phone,
        tenant_permanent_addr: data.tenant.permanentAddress,
        tenant_aadhaar:       data.tenant.aadhaarLastFour
          ? `XXXX-XXXX-${data.tenant.aadhaarLastFour}`
          : 'Not provided',

        // Property details
        property_address:     data.property.address,
        property_city:        data.property.city,
        property_state:       data.property.state,
        property_pincode:     data.property.pincode,

        // Stay details
        checkin_date:         new Date(data.booking.moveInDate)
          .toLocaleDateString('en-IN'),
        monthly_rent:         `₹${data.booking.monthlyRent.toLocaleString('en-IN')}`,
      },
      instructions: [
        `Visit: ${portalUrl ?? 'your state police website'}`,
        'Login or register with your phone number',
        'Fill the Tenant Verification form using the pre-filled data above',
        'Upload tenant photo if required',
        'Submit and save the acknowledgement number',
        'Mark verification as "Submitted" in your Rent & Stay dashboard',
      ],
    }
  }

  // ─── UTILS ───────────────────────────────────────────────────────────────────

  private numberToWords(n: number): string {
    const ones  = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
                   'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
                   'Seventeen','Eighteen','Nineteen']
    const tens  = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']

    if (n === 0) return 'Zero'
    if (n < 20)  return ones[n]
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + this.numberToWords(n % 100) : '')

    if (n < 100000)  return this.numberToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + this.numberToWords(n % 1000) : '')
    if (n < 10000000) return this.numberToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + this.numberToWords(n % 100000) : '')
    return this.numberToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + this.numberToWords(n % 10000000) : '')
  }
}
