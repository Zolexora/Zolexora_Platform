import { Injectable } from '@nestjs/common'
import { UploadService } from '../../config/upload.service'
import { generateReceiptNumber } from '@rent-stay/utils'

export interface ReceiptData {
  receiptNumber:  string
  tenantName:     string
  tenantPhone:    string
  ownerName:      string
  propertyAddress: string
  propertyCity:   string
  monthlyRent:    number
  platformFee:    number
  paidAt:         Date
  paymentMethod:  string
  razorpayPaymentId: string
  period:         string  // e.g. "February 2025"
}

@Injectable()
export class ReceiptService {
  constructor(private upload: UploadService) {}

  buildReceiptHTML(data: ReceiptData): string {
    const paidDate = data.paidAt.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
    const paidTime = data.paidAt.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit',
    })

    const methodLabel: Record<string, string> = {
      upi:         'UPI',
      upi_direct:  'UPI (Direct)',
      card:        'Debit/Credit Card',
      net_banking: 'Net Banking',
      wallet:      'Wallet',
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f5f5f5; padding: 20px; }
    .receipt { background: #fff; max-width: 500px; margin: 0 auto; border-radius: 8px;
               box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow: hidden; }
    .header { background: #0F6E56; color: #fff; padding: 24px; text-align: center; }
    .brand { font-size: 20px; font-weight: 700; letter-spacing: 1px; }
    .receipt-title { font-size: 13px; opacity: 0.85; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
    .receipt-no { font-size: 12px; opacity: 0.7; margin-top: 6px; }
    .amount-block { background: #E8F5F1; text-align: center; padding: 20px; border-bottom: 1px solid #e0e0e0; }
    .amount-label { font-size: 12px; color: #555; text-transform: uppercase; letter-spacing: 1px; }
    .amount-value { font-size: 36px; font-weight: 700; color: #0F6E56; margin-top: 4px; }
    .amount-period { font-size: 13px; color: #777; margin-top: 4px; }
    .section { padding: 16px 24px; border-bottom: 1px solid #f0f0f0; }
    .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 10px; }
    .row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
    .row:last-child { margin-bottom: 0; }
    .label { font-size: 13px; color: #666; }
    .value { font-size: 13px; color: #222; font-weight: 500; text-align: right; max-width: 60%; }
    .success-badge { display: inline-block; background: #d4edda; color: #155724;
                     font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
    .footer { padding: 16px 24px; text-align: center; }
    .footer p { font-size: 11px; color: #aaa; line-height: 1.6; }
    .txn-id { font-family: monospace; font-size: 11px; color: #888; word-break: break-all; }
  </style>
</head>
<body>
<div class="receipt">

  <div class="header">
    <div class="brand">Rent & Stay</div>
    <div class="receipt-title">Payment Receipt</div>
    <div class="receipt-no">#${data.receiptNumber}</div>
  </div>

  <div class="amount-block">
    <div class="amount-label">Amount Paid</div>
    <div class="amount-value">₹${data.monthlyRent.toLocaleString('en-IN')}</div>
    <div class="amount-period">Rent for ${data.period}</div>
  </div>

  <div class="section">
    <div class="section-title">Payment Info</div>
    <div class="row">
      <span class="label">Status</span>
      <span class="value"><span class="success-badge">✓ Paid</span></span>
    </div>
    <div class="row">
      <span class="label">Date</span>
      <span class="value">${paidDate}</span>
    </div>
    <div class="row">
      <span class="label">Time</span>
      <span class="value">${paidTime}</span>
    </div>
    <div class="row">
      <span class="label">Method</span>
      <span class="value">${methodLabel[data.paymentMethod] ?? data.paymentMethod}</span>
    </div>
    <div class="row">
      <span class="label">Transaction ID</span>
      <span class="value txn-id">${data.razorpayPaymentId}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Tenant</div>
    <div class="row">
      <span class="label">Name</span>
      <span class="value">${data.tenantName}</span>
    </div>
    <div class="row">
      <span class="label">Phone</span>
      <span class="value">+91 ${data.tenantPhone}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Property</div>
    <div class="row">
      <span class="label">Address</span>
      <span class="value">${data.propertyAddress}</span>
    </div>
    <div class="row">
      <span class="label">City</span>
      <span class="value">${data.propertyCity}</span>
    </div>
    <div class="row">
      <span class="label">Owner</span>
      <span class="value">${data.ownerName}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Breakdown</div>
    <div class="row">
      <span class="label">Rent Amount</span>
      <span class="value">₹${data.monthlyRent.toLocaleString('en-IN')}</span>
    </div>
    <div class="row">
      <span class="label">Platform Fee</span>
      <span class="value">₹${data.platformFee.toLocaleString('en-IN')}</span>
    </div>
    <div class="row" style="border-top:1px solid #eee;padding-top:8px;margin-top:4px">
      <span class="label" style="font-weight:600">Total Paid</span>
      <span class="value" style="font-weight:700;color:#0F6E56">
        ₹${(data.monthlyRent + data.platformFee).toLocaleString('en-IN')}
      </span>
    </div>
  </div>

  <div class="footer">
    <p>This is a computer-generated receipt and does not require a signature.<br>
    Powered by <strong>Rent & Stay</strong> · www.rentandstay.in<br>
    For support: support@rentandstay.in</p>
  </div>

</div>
</body>
</html>`
  }

  async generateAndUpload(data: ReceiptData): Promise<{ receiptNumber: string; receiptUrl: string }> {
    const html    = this.buildReceiptHTML(data)
    const buffer  = Buffer.from(html)

    // Upload as HTML to S3 — can be served as a webpage or converted to PDF
    const { key } = await this.upload.uploadPDF(
      buffer, 'application/pdf', 'receipts', data.receiptNumber,
    )

    const receiptUrl = await this.upload.getPresignedUrl(key, 60 * 60 * 24 * 90) // 90 days

    return { receiptNumber: data.receiptNumber, receiptUrl }
  }
}
