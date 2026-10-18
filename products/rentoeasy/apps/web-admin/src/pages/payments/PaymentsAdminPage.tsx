import { useState }                              from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, IndianRupee, AlertCircle, RefreshCw, RotateCcw } from 'lucide-react'
import { adminAPI }       from '@/services/api'
import { formatCurrency } from '@zolexora/rentoeasy-utils'

export function PaymentsAdminPage() {
  const qc = useQueryClient()
  const [refundId,  setRefundId]  = useState('')
  const [refundAmt, setRefundAmt] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [showRefund, setShowRefund] = useState(false)

  const { data: overview } = useQuery({
    queryKey: ['payment-overview'],
    queryFn:  () => adminAPI.paymentOverview() as any,
    refetchInterval: 30000,
  })
  const { data: payoutData } = useQuery({
    queryKey: ['payout-queue'],
    queryFn:  () => adminAPI.payoutQueue() as any,
    staleTime: 30000,
  })

  const payoutMut = useMutation({
    mutationFn: (paymentId: string) => adminAPI.triggerPayout(paymentId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['payout-queue'] }),
  })

  const refundMut = useMutation({
    mutationFn: () => adminAPI.refund({
      paymentId: refundId,
      reason:    refundReason,
      ...(refundAmt && { amountPaise: Math.round(Number(refundAmt) * 100) }),
    }),
    onSuccess: () => {
      setShowRefund(false); setRefundId(''); setRefundAmt(''); setRefundReason('')
      qc.invalidateQueries({ queryKey: ['payment-overview'] })
    },
  })

  const ov     = overview as any
  const payouts = (payoutData as any)?.data ?? []

  const metricCards = [
    { label: 'Total Collected',    value: formatCurrency(ov?.totalCollectedRupees ?? 0),   color: 'text-green-700 bg-green-50' },
    { label: 'This Month',         value: formatCurrency(ov?.thisMonthRupees ?? 0),         color: 'text-blue-700 bg-blue-50'   },
    { label: 'Platform Revenue',   value: formatCurrency(ov?.platformRevenueRupees ?? 0),  color: 'text-violet-700 bg-violet-50'},
    { label: 'Overdue Payments',   value: ov?.overdueCount ?? 0,                            color: 'text-red-700 bg-red-50'     },
    { label: 'Failed Payments',    value: ov?.failedCount  ?? 0,                            color: 'text-amber-700 bg-amber-50' },
    { label: 'Total Transactions', value: ov?.totalTransactions ?? 0,                       color: 'text-gray-700 bg-gray-100'  },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Payments</h1>
        <button onClick={() => setShowRefund(true)}
          className="flex items-center gap-1.5 text-sm bg-amber-600 text-white px-3 py-2 rounded-lg hover:bg-amber-700">
          <RotateCcw size={14} /> Issue Refund
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {metricCards.map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl mb-3 ${color}`}>
              <IndianRupee size={16} />
            </div>
            <p className="text-xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Payout queue */}
      {payouts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Pending Payouts ({payouts.length})</h2>
            <span className="badge badge-amber">Action required</span>
          </div>
          <div className="divide-y divide-gray-50">
            {payouts.map((po: any) => (
              <div key={po.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-9 h-9 bg-gray-100 rounded-full overflow-hidden flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-gray-500">{po.owner?.name?.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{po.owner?.name}</p>
                  <p className="text-xs text-gray-400">{po.owner?.phone} · {po.payment?.receiptNumber}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(po.amountPaise / 100)}</p>
                  <span className={`badge capitalize text-[10px] ${po.status==='failed'?'badge-red':'badge-amber'}`}>{po.status}</span>
                </div>
                <button
                  onClick={() => payoutMut.mutate(po.paymentId)}
                  disabled={payoutMut.isPending}
                  className="flex items-center gap-1.5 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 shrink-0">
                  {payoutMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  Pay Out
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {payouts.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <IndianRupee size={28} className="text-gray-200 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">No pending payouts</p>
          <p className="text-xs text-gray-400 mt-1">All owner payouts are up to date</p>
        </div>
      )}

      {/* Refund modal */}
      {showRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowRefund(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Issue Refund</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment UUID</label>
              <input className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm w-full focus:border-red-400"
                placeholder="paste-payment-uuid-here" value={refundId}
                onChange={(e) => setRefundId(e.target.value.trim())} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Refund Amount (₹) <span className="text-gray-400 font-normal">— leave blank for full refund</span>
              </label>
              <input className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm w-full focus:border-red-400"
                type="number" placeholder="e.g. 5000" value={refundAmt}
                onChange={(e) => setRefundAmt(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason <span className="text-red-500">*</span></label>
              <input className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm w-full focus:border-red-400"
                placeholder="Tenant cancelled before move-in" value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)} />
            </div>

            {refundMut.isError && (
              <div className="flex gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{(refundMut.error as Error).message}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowRefund(false)} className="flex-1 border border-gray-200 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => refundMut.mutate()}
                disabled={!refundId || !refundReason || refundMut.isPending}
                className="flex-1 bg-red-600 text-white font-medium py-2.5 rounded-lg hover:bg-red-700 disabled:opacity-50">
                {refundMut.isPending ? 'Processing…' : 'Issue Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
