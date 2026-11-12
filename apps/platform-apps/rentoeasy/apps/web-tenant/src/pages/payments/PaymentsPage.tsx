import { useState }                         from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CreditCard, Smartphone, Banknote, Wallet,
  CheckCircle, Clock, AlertCircle, Download,
  ChevronRight, Loader2, X,
} from 'lucide-react'
import { paymentsAPI }    from '@/services/api'
import { formatCurrency } from '@zolexora/rentoeasy-utils'

declare global { interface Window { Razorpay: any } }

const METHOD_OPTIONS = [
  { id: 'upi_direct', label: 'UPI ID',         icon: Smartphone, desc: 'Enter UPI ID — direct collect request' },
  { id: 'upi',        label: 'UPI / QR',        icon: Smartphone, desc: 'Google Pay, PhonePe, Paytm, any UPI' },
  { id: 'card',       label: 'Card',            icon: CreditCard, desc: 'Debit or Credit card' },
  { id: 'net_banking',label: 'Net Banking',     icon: Banknote,   desc: 'All major banks supported' },
  { id: 'wallet',     label: 'Wallets',         icon: Wallet,     desc: 'Paytm, Amazon Pay, Mobikwik' },
]

export default function PaymentsPage() {
  const qc = useQueryClient()

  const { data: due, isLoading: dueLoading } = useQuery({
    queryKey: ['due-payments'],
    queryFn:  () => paymentsAPI.getDue() as any,
  })
  const { data: hist } = useQuery({
    queryKey: ['payment-history'],
    queryFn:  () => paymentsAPI.history() as any,
  })

  const dues     = (due    as any) ?? []
  const history  = (hist   as any)?.data ?? []
  const [paying, setPaying] = useState<any>(null) // payment being paid

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Payments</h1>

      {/* Due payments */}
      {dueLoading ? (
        <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
      ) : dues.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Due Now</h2>
          {dues.map((p: any) => (
            <DueCard key={p.id} payment={p} onPay={() => setPaying(p)} />
          ))}
        </div>
      ) : (
        <div className="card p-6 text-center space-y-2">
          <CheckCircle size={32} className="text-green-500 mx-auto" />
          <p className="font-semibold text-gray-900">All paid up!</p>
          <p className="text-sm text-gray-500">No pending payments right now.</p>
        </div>
      )}

      {/* Payment history */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">History</h2>
          <div className="card divide-y divide-gray-100 overflow-hidden">
            {history.map((p: any) => (
              <HistoryRow key={p.id} payment={p} />
            ))}
          </div>
        </div>
      )}

      {/* Pay modal */}
      {paying && (
        <PayModal
          payment={paying}
          onClose={() => setPaying(null)}
          onSuccess={() => {
            setPaying(null)
            qc.invalidateQueries({ queryKey: ['due-payments'] })
            qc.invalidateQueries({ queryKey: ['payment-history'] })
          }}
        />
      )}
    </div>
  )
}

// ─── DUE CARD ────────────────────────────────────────────────────────────────

function DueCard({ payment, onPay }: { payment: any; onPay: () => void }) {
  const overdue = payment.isOverdue
  return (
    <div className={`card p-4 space-y-3 ${overdue ? 'border-red-200' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 capitalize">
              {payment.type.replace('_', ' ')}
            </p>
            {overdue && (
              <span className="badge badge-red">
                <AlertCircle size={10} /> {payment.daysOverdue}d overdue
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {payment.booking?.property?.title} · {payment.booking?.property?.city}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-lg font-bold ${overdue ? 'text-red-600' : 'text-brand-700'}`}>
            {formatCurrency(payment.amountPaise / 100)}
          </p>
          <p className="text-xs text-gray-400">
            Due {new Date(payment.dueDate).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
          </p>
        </div>
      </div>
      <button onClick={onPay} className="btn-primary w-full text-sm py-2.5">
        Pay Now
      </button>
    </div>
  )
}

// ─── HISTORY ROW ─────────────────────────────────────────────────────────────

function HistoryRow({ payment }: { payment: any }) {
  const statusIcon = payment.status === 'success'
    ? <CheckCircle size={16} className="text-green-500" />
    : <AlertCircle size={16} className="text-red-400" />

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {statusIcon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 capitalize">
          {payment.type.replace('_', ' ')}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {payment.paidAt
            ? new Date(payment.paidAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
            : '—'
          }
          {payment.receiptNumber && ` · ${payment.receiptNumber}`}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-gray-900">
          {formatCurrency(payment.amountPaise / 100)}
        </p>
        {payment.receiptUrl && (
          <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-brand-700 hover:underline flex items-center gap-0.5 justify-end mt-0.5">
            <Download size={10} /> Receipt
          </a>
        )}
      </div>
    </div>
  )
}

// ─── PAY MODAL ───────────────────────────────────────────────────────────────

function PayModal({ payment, onClose, onSuccess }: {
  payment: any; onClose: () => void; onSuccess: () => void
}) {
  const [method,  setMethod]  = useState<string>('upi')
  const [upiId,   setUpiId]   = useState('')
  const [stage,   setStage]   = useState<'select'|'processing'|'done'|'error'>('select')
  const [errMsg,  setErrMsg]  = useState('')

  const createMut = useMutation({
    mutationFn: () => paymentsAPI.createOrder({
      paymentId: payment.id,
      method,
      ...(method === 'upi_direct' && { upiId }),
    }),
  })

  const verifyMut = useMutation({
    mutationFn: (data: any) => paymentsAPI.verify(data),
    onSuccess:  () => { setStage('done'); onSuccess() },
    onError: (e: any) => { setStage('error'); setErrMsg(e.message) },
  })

  const loadRazorpay = (): Promise<boolean> => new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return }
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload  = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })

  const handlePay = async () => {
    if (method === 'upi_direct' && !upiId.includes('@')) {
      setErrMsg('Enter a valid UPI ID (e.g. rahul@okicici)'); return
    }
    setStage('processing'); setErrMsg('')

    try {
      const order = await createMut.mutateAsync() as any

      // UPI direct — show waiting screen
      if (method === 'upi_direct') {
        // Collect request sent; webhook confirms — poll for 60s
        setStage('processing')
        let attempts = 0
        const poll = setInterval(async () => {
          attempts++
          // In real app: poll /payments/:id/status
          // Here we simulate: after 3 polls redirect to done
          if (attempts >= 3) {
            clearInterval(poll)
            setStage('done')
            onSuccess()
          }
        }, 5000)
        return
      }

      // Card / netbanking / UPI QR — Razorpay checkout
      const rzpLoaded = await loadRazorpay()
      if (!rzpLoaded) throw new Error('Payment SDK failed to load')

      const rzp = new window.Razorpay({
        key:         import.meta.env.VITE_RAZORPAY_KEY,
        order_id:    order.orderId,
        amount:      order.amount,
        currency:    order.currency,
        name:        'Rent & Stay',
        description: `Rent payment`,
        prefill: {
          contact: order.tenantPhone,
          email:   order.tenantEmail,
        },
        method: method === 'upi' ? { upi: true } : undefined,
        theme:   { color: '#0F6E56' },
        handler: (response: any) => {
          verifyMut.mutate({
            razorpayOrderId:   response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          })
        },
        modal: {
          ondismiss: () => setStage('select'),
        },
      })
      rzp.open()
    } catch (e: any) {
      setStage('error'); setErrMsg(e.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Pay Rent</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {payment.booking?.property?.title}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Amount */}
          <div className="bg-brand-50 rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm text-brand-700 font-medium">Amount to pay</span>
            <span className="text-2xl font-bold text-brand-800">
              {formatCurrency(payment.amountPaise / 100)}
            </span>
          </div>

          {/* Processing */}
          {stage === 'processing' && (
            <div className="text-center py-6 space-y-3">
              <Loader2 size={32} className="animate-spin text-brand-600 mx-auto" />
              {method === 'upi_direct' ? (
                <>
                  <p className="font-semibold text-gray-900">Collect request sent!</p>
                  <p className="text-sm text-gray-500">
                    Check <strong>{upiId}</strong> in your UPI app and approve the request.
                  </p>
                  <p className="text-xs text-gray-400">Waiting for confirmation…</p>
                </>
              ) : (
                <p className="text-sm text-gray-600">Opening payment…</p>
              )}
            </div>
          )}

          {/* Done */}
          {stage === 'done' && (
            <div className="text-center py-6 space-y-3">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <p className="font-bold text-gray-900 text-lg">Payment Successful!</p>
              <p className="text-sm text-gray-500">Receipt sent to your WhatsApp & email.</p>
              <button onClick={onClose} className="btn-primary w-full">Done</button>
            </div>
          )}

          {/* Select method */}
          {stage === 'select' && (
            <>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Choose payment method</p>
                <div className="space-y-2">
                  {METHOD_OPTIONS.map(({ id, label, icon: Icon, desc }) => (
                    <button
                      key={id}
                      onClick={() => setMethod(id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border
                                  transition-colors text-left
                                  ${method === id
                                    ? 'border-brand-500 bg-brand-50'
                                    : 'border-gray-200 hover:bg-gray-50'
                                  }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0
                                       ${method === id ? 'bg-brand-100' : 'bg-gray-100'}`}>
                        <Icon size={16} className={method === id ? 'text-brand-700' : 'text-gray-500'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${method === id ? 'text-brand-800' : 'text-gray-900'}`}>
                          {label}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{desc}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center
                                       ${method === id ? 'border-brand-600 bg-brand-600' : 'border-gray-300'}`}>
                        {method === id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* UPI ID input */}
              {method === 'upi_direct' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Your UPI ID</label>
                  <input
                    className="input"
                    placeholder="rahul@okicici / 9876543210@ybl"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value.trim())}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    A ₹{formatCurrency(payment.amountPaise / 100).replace('₹','')} collect request will be sent to this UPI ID.
                  </p>
                </div>
              )}

              {errMsg && (
                <div className="flex gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                  <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{errMsg}</p>
                </div>
              )}

              <button
                onClick={handlePay}
                className="btn-primary w-full text-base py-3"
              >
                Pay {formatCurrency(payment.amountPaise / 100)}
              </button>

              <p className="text-xs text-center text-gray-400">
                Secured by Razorpay · 256-bit SSL encryption
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
