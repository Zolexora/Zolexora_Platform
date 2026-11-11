// ─── EARNINGS PAGE ────────────────────────────────────────────────────────────
import { useQuery }      from '@tanstack/react-query'
import { formatCurrency } from '@zolexora/rentoeasy-utils'
import { IndianRupee, TrendingUp, Clock, CheckCircle, Download } from 'lucide-react'
import { paymentsAPI }   from '@/services/api'

export function EarningsPage() {
  const { data }    = useQuery({ queryKey: ['earnings'], queryFn: () => paymentsAPI.earnings() as any })
  const { data: hist } = useQuery({ queryKey: ['payment-history'], queryFn: () => paymentsAPI.history() as any })
  const earn    = data    as any
  const history = (hist as any)?.data ?? []

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Earnings</h1>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Earned',  value: formatCurrency(earn?.totalEarnedRupees   ?? 0), icon: IndianRupee, cls: 'text-violet-700 bg-violet-50' },
          { label: 'This Month',    value: formatCurrency(earn?.thisMonthRupees      ?? 0), icon: TrendingUp,  cls: 'text-green-700 bg-green-50'  },
          { label: 'Total Payments',value: earn?.totalPayments ?? 0,                         icon: CheckCircle, cls: 'text-blue-700 bg-blue-50'    },
          { label: 'Payout Pending',value: formatCurrency(earn?.pendingPayoutRupees  ?? 0), icon: Clock,       cls: 'text-amber-700 bg-amber-50'  },
        ].map(({ label, value, icon: Icon, cls }) => (
          <div key={label} className="card p-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${cls.split(' ')[1]}`}>
              <Icon size={18} className={cls.split(' ')[0]} />
            </div>
            <p className="text-xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {history.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Payment History</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {history.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                  <IndianRupee size={16} className="text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 capitalize">
                    {p.type?.replace('_', ' ')} received
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {p.booking?.property?.title} ·{' '}
                    {p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-green-700">+{formatCurrency(p.ownerAmountPaise / 100)}</p>
                  {p.receiptUrl && (
                    <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-violet-600 hover:underline flex items-center gap-0.5 justify-end mt-0.5">
                      <Download size={10} /> Receipt
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── KYC PAGE ─────────────────────────────────────────────────────────────────
import { useState, useRef }              from 'react'
import { useMutation, useQueryClient }   from '@tanstack/react-query'
import { kycAPI }                        from '@/services/api'
import { Upload, ChevronDown, ChevronUp, Loader2, CheckCircle as CC, XCircle } from 'lucide-react'

export function KYCPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const { data } = useQuery({ queryKey: ['kyc-status'], queryFn: () => kycAPI.getStatus() as any, staleTime: 30000 })
  const kycStatus   = (data as any)?.overall ?? 'pending'
  const docs        = (data as any)?.documents ?? []
  const aadhaarDoc  = docs.find((d: any) => d.type === 'aadhaar')
  const panDoc      = docs.find((d: any) => d.type === 'pan')
  const bankDoc     = docs.find((d: any) => d.type === 'bank_account')

  const [aadhaarStep, setAadhaarStep] = useState<'idle'|'uploading'|'need_hint'|'done'>('idle')
  const [nameHint,    setNameHint]    = useState('')
  const [yearHint,    setYearHint]    = useState('')
  const [file,        setFile]        = useState<File|null>(null)
  const [pan,         setPan]         = useState('')
  const [account,     setAccount]     = useState('')
  const [ifsc,        setIfsc]        = useState('')
  const [error,       setError]       = useState('')
  const [openFaq,     setOpenFaq]     = useState<number|null>(null)

  const aadhaarMut = useMutation({
    mutationFn: (f: File) => kycAPI.uploadAadhaar(f) as any,
    onSuccess:  () => { setAadhaarStep('done'); qc.invalidateQueries({ queryKey: ['kyc-status'] }) },
    onError:    (e: any) => { e.message?.includes('unlock') ? setAadhaarStep('need_hint') : setError(e.message) },
  })
  const retryMut = useMutation({
    mutationFn: () => kycAPI.retryAadhaar(file!, nameHint, yearHint) as any,
    onSuccess:  () => { setAadhaarStep('done'); qc.invalidateQueries({ queryKey: ['kyc-status'] }) },
    onError:    (e: any) => setError(e.message),
  })
  const panMut = useMutation({
    mutationFn: () => kycAPI.verifyPAN(pan),
    onSuccess:  () => { setPan(''); qc.invalidateQueries({ queryKey: ['kyc-status'] }) },
    onError:    (e: any) => setError(e.message),
  })
  const bankMut = useMutation({
    mutationFn: () => kycAPI.verifyBank(account, ifsc),
    onSuccess:  () => { setAccount(''); setIfsc(''); qc.invalidateQueries({ queryKey: ['kyc-status'] }) },
    onError:    (e: any) => setError(e.message),
  })

  const DocRow = ({ label, doc, extra }: { label: string; doc: any; extra?: React.ReactNode }) => (
    <div className="flex items-center gap-3 py-3.5 border-b border-gray-50 last:border-0">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
        doc?.status === 'verified' ? 'bg-green-50' : doc?.status === 'rejected' ? 'bg-red-50' : 'bg-gray-50'}`}>
        {doc?.status === 'verified' ? <CC size={16} className="text-green-600" />
         : doc?.status === 'rejected' ? <XCircle size={16} className="text-red-500" />
         : <Upload size={16} className="text-gray-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className={`text-xs mt-0.5 capitalize ${
          doc?.status === 'verified' ? 'text-green-600' : doc?.status === 'submitted' ? 'text-blue-500'
          : doc?.status === 'rejected' ? 'text-red-500' : 'text-gray-400'}`}>
          {doc?.status ?? 'Not submitted'}
          {doc?.rejectionReason && ` — ${doc.rejectionReason}`}
        </p>
      </div>
      {extra}
    </div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Verification</h1>

      {kycStatus === 'verified' && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
          <CC size={24} className="text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-800">Fully Verified ✓</p>
            <p className="text-sm text-green-600 mt-0.5">You can list and manage properties.</p>
          </div>
        </div>
      )}

      {/* Step 1 — Aadhaar */}
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 text-sm">Step 1 — Aadhaar Verification</h2>
        <DocRow label="Aadhaar PDF" doc={aadhaarDoc} />

        {aadhaarDoc?.status !== 'verified' && (
          <>
            {aadhaarStep === 'idle' && (
              <>
                <button onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-200 rounded-xl py-6
                             flex flex-col items-center gap-2 hover:border-violet-400 hover:bg-violet-50 transition-colors">
                  <Upload size={20} className="text-gray-300" />
                  <p className="text-sm text-gray-600">Upload Aadhaar PDF</p>
                  <p className="text-xs text-gray-400">Password-protected is fine · max 10MB</p>
                </button>
                <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setAadhaarStep('uploading'); aadhaarMut.mutate(f) } }} />
              </>
            )}
            {aadhaarStep === 'uploading' && (
              <div className="flex flex-col items-center py-4 gap-2">
                <Loader2 size={24} className="animate-spin text-violet-600" />
                <p className="text-sm text-gray-600">Verifying…</p>
              </div>
            )}
            {aadhaarStep === 'need_hint' && (
              <div className="space-y-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-sm font-medium text-amber-800">Enter name as on Aadhaar + birth year</p>
                <input className="input text-sm" placeholder="RAHUL SHARMA"
                  value={nameHint} onChange={(e) => setNameHint(e.target.value.toUpperCase())} />
                <input className="input text-sm" placeholder="Birth year e.g. 1995" maxLength={4}
                  value={yearHint} onChange={(e) => setYearHint(e.target.value.replace(/\D/g,''))} />
                <button onClick={() => retryMut.mutate()} disabled={!nameHint || yearHint.length !== 4 || retryMut.isPending}
                  className="btn-primary w-full text-sm">
                  {retryMut.isPending ? 'Retrying…' : 'Retry →'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Step 2 — PAN */}
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 text-sm">Step 2 — PAN Verification</h2>
        <DocRow label="PAN Card" doc={panDoc} />
        {panDoc?.status !== 'verified' && (
          <div className="flex gap-2">
            <input className="input flex-1 text-sm uppercase" placeholder="ABCDE1234F"
              value={pan} maxLength={10} onChange={(e) => setPan(e.target.value.toUpperCase())} />
            <button onClick={() => panMut.mutate()} disabled={pan.length !== 10 || panMut.isPending}
              className="btn-primary text-sm px-4 shrink-0">
              {panMut.isPending ? '…' : 'Verify'}
            </button>
          </div>
        )}
      </div>

      {/* Step 3 — Bank */}
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 text-sm">Step 3 — Bank Account (for payouts)</h2>
        <DocRow label="Bank Account" doc={bankDoc}
          extra={bankDoc?.status === 'verified' && <span className="text-xs text-gray-500">{(data as any)?.bankAccountMasked}</span>} />
        {bankDoc?.status !== 'verified' && (
          <div className="space-y-2">
            <input className="input text-sm" placeholder="Account number"
              value={account} onChange={(e) => setAccount(e.target.value)} />
            <input className="input text-sm uppercase" placeholder="IFSC code (e.g. HDFC0001234)"
              value={ifsc} maxLength={11} onChange={(e) => setIfsc(e.target.value.toUpperCase())} />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button onClick={() => bankMut.mutate()}
              disabled={!account || ifsc.length < 11 || bankMut.isPending}
              className="btn-primary w-full text-sm">
              {bankMut.isPending ? 'Verifying bank…' : 'Verify Bank Account (₹1 penny drop)'}
            </button>
            <p className="text-xs text-gray-400 text-center">We send ₹1 to confirm account ownership</p>
          </div>
        )}
      </div>
    </div>
  )
}
