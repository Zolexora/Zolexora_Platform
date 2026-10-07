import { useState, useRef }   from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Upload, CheckCircle, Clock, XCircle, AlertCircle,
  FileText, HelpCircle, ChevronDown, ChevronUp,
} from 'lucide-react'
import { kycAPI } from '@/services/api'

type UploadStep = 'idle' | 'uploading' | 'done' | 'failed' | 'need_hint'

export default function KYCPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step,       setStep]       = useState<UploadStep>('idle')
  const [error,      setError]      = useState('')
  const [file,       setFile]       = useState<File | null>(null)
  const [nameHint,   setNameHint]   = useState('')
  const [yearHint,   setYearHint]   = useState('')
  const [faqOpen,    setFaqOpen]    = useState<number | null>(null)

  const { data } = useQuery({
    queryKey: ['kyc-status'],
    queryFn:  () => kycAPI.getStatus() as any,
    staleTime: 1000 * 30,
  })

  const status       = (data as any)?.overall       ?? 'pending'
  const aadhaarDoc   = (data as any)?.documents?.find((d: any) => d.type === 'aadhaar')
  const aadhaarStat  = aadhaarDoc?.status
  const pendingSteps = (data as any)?.pendingSteps  ?? []

  const uploadMut = useMutation({
    mutationFn: (f: File) => kycAPI.uploadAadhaar(f) as any,
    onSuccess: () => { setStep('done'); qc.invalidateQueries({ queryKey: ['kyc-status'] }) },
    onError: (err: any) => {
      if (err.code === 'PDF_UNLOCK_FAILED' || err.message?.includes('unlock')) {
        setStep('need_hint')
      } else {
        setStep('failed'); setError(err.message)
      }
    },
  })

  const retryMut = useMutation({
    mutationFn: () => kycAPI.retryAadhaar(file!, nameHint, yearHint) as any,
    onSuccess: () => { setStep('done'); qc.invalidateQueries({ queryKey: ['kyc-status'] }) },
    onError: (err: any) => { setStep('failed'); setError(err.message) },
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.type !== 'application/pdf') { setError('Please upload a PDF file'); return }
    if (f.size > 10 * 1024 * 1024)   { setError('File must be under 10MB'); return }
    setFile(f); setStep('uploading'); setError('')
    uploadMut.mutate(f)
  }

  const StatusCard = () => {
    if (aadhaarStat === 'verified') return (
      <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
        <CheckCircle size={24} className="text-green-600 shrink-0" />
        <div>
          <p className="font-semibold text-green-800">Aadhaar Verified ✓</p>
          <p className="text-sm text-green-600 mt-0.5">Your identity has been confirmed.</p>
        </div>
      </div>
    )
    if (aadhaarStat === 'submitted') return (
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <Clock size={24} className="text-blue-500 shrink-0 animate-pulse" />
        <div>
          <p className="font-semibold text-blue-800">Under Review</p>
          <p className="text-sm text-blue-600 mt-0.5">Usually takes 2–5 minutes.</p>
        </div>
      </div>
    )
    if (aadhaarDoc?.rejectionReason) return (
      <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
        <XCircle size={24} className="text-red-500 shrink-0" />
        <div>
          <p className="font-semibold text-red-800">Verification Failed</p>
          <p className="text-sm text-red-600 mt-0.5">{aadhaarDoc.rejectionReason}</p>
        </div>
      </div>
    )
    return null
  }

  const FAQs = [
    {
      q: 'Where do I download my Aadhaar PDF?',
      a: 'Go to myaadhaar.uidai.gov.in → "Download Aadhaar" → enter your 12-digit Aadhaar number → enter OTP → PDF downloads.',
    },
    {
      q: 'The PDF asks for a password — what is it?',
      a: 'Password = first 4 letters of your name (CAPITALS) + birth year. Example: Name "Rahul Sharma", born 1995 → password is RAHU1995.',
    },
    {
      q: 'Can I upload the password-protected PDF?',
      a: 'Yes! Just upload it as-is. We unlock it automatically. If auto-unlock fails, we\'ll ask for your name + birth year to try again.',
    },
    {
      q: 'Is my Aadhaar data safe?',
      a: 'Yes. The unlocked PDF is sent directly to Digio for verification and is never stored on our servers in unlocked form. Your data is encrypted at rest.',
    },
  ]

  return (
    <div className="max-w-lg mx-auto px-4 py-5 space-y-5">

      <div>
        <h1 className="text-xl font-bold text-gray-900">Identity Verification</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Verify your Aadhaar to unlock room booking
        </p>
      </div>

      <StatusCard />

      {/* Upload area — show if not verified */}
      {aadhaarStat !== 'verified' && step !== 'done' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center shrink-0">
              <FileText size={18} className="text-brand-700" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Upload Aadhaar PDF</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Download from myaadhaar.uidai.gov.in. Password-protected is fine — we unlock automatically.
              </p>
            </div>
          </div>

          {/* Upload zone */}
          {step === 'idle' || step === 'failed' ? (
            <>
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-8
                           flex flex-col items-center gap-2 hover:border-brand-400
                           hover:bg-brand-50 transition-colors group"
              >
                <Upload size={24} className="text-gray-300 group-hover:text-brand-500 transition-colors" />
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">Click to upload Aadhaar PDF</p>
                  <p className="text-xs text-gray-400 mt-0.5">PDF only · max 10MB</p>
                </div>
              </button>
              <input
                ref={fileRef} type="file" accept=".pdf,application/pdf"
                className="hidden" onChange={handleFileSelect}
              />
              {error && (
                <div className="flex gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                  <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </>
          ) : step === 'uploading' ? (
            <div className="flex flex-col items-center py-6 gap-3">
              <div className="w-12 h-12 border-4 border-gray-100 border-t-brand-600
                              rounded-full animate-spin" />
              <p className="text-sm text-gray-600 font-medium">Verifying your Aadhaar…</p>
              <p className="text-xs text-gray-400">This takes a few seconds</p>
            </div>
          ) : step === 'need_hint' ? (
            <HintForm
              name={nameHint} setName={setNameHint}
              year={yearHint} setYear={setYearHint}
              onRetry={() => retryMut.mutate()}
              loading={retryMut.isPending}
              error={retryMut.isError ? (retryMut.error as Error).message : ''}
            />
          ) : null}
        </div>
      )}

      {/* Download guide */}
      {aadhaarStat !== 'verified' && (
        <div className="card p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm">How to download Aadhaar PDF</h3>
          {[
            { step: '1', text: 'Open myaadhaar.uidai.gov.in on your phone or computer' },
            { step: '2', text: 'Tap "Download Aadhaar" and enter your 12-digit number' },
            { step: '3', text: 'Enter OTP received on your Aadhaar-linked mobile' },
            { step: '4', text: 'PDF downloads — upload it here as-is (no need to unlock)' },
          ].map(({ step: s, text }) => (
            <div key={s} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs
                               font-bold flex items-center justify-center shrink-0 mt-0.5">
                {s}
              </span>
              <p className="text-sm text-gray-600">{text}</p>
            </div>
          ))}
          <a
            href="https://myaadhaar.uidai.gov.in/genricDownloadAadhaar/en"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center btn-outline text-sm mt-2"
          >
            Open UIDAI Download Page →
          </a>
        </div>
      )}

      {/* FAQs */}
      <div className="card divide-y divide-gray-100 overflow-hidden">
        {FAQs.map((faq, i) => (
          <div key={i}>
            <button
              onClick={() => setFaqOpen(faqOpen === i ? null : i)}
              className="w-full flex items-center justify-between px-4 py-3.5 text-left"
            >
              <span className="text-sm font-medium text-gray-900 pr-4">{faq.q}</span>
              {faqOpen === i
                ? <ChevronUp size={15} className="text-gray-400 shrink-0" />
                : <ChevronDown size={15} className="text-gray-400 shrink-0" />
              }
            </button>
            {faqOpen === i && (
              <div className="px-4 pb-3.5">
                <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function HintForm({ name, setName, year, setYear, onRetry, loading, error }: any) {
  return (
    <div className="space-y-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
      <div className="flex items-start gap-2">
        <HelpCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">One more step needed</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Enter your name exactly as printed on your Aadhaar card and your birth year.
          </p>
        </div>
      </div>

      <input
        className="input text-sm"
        placeholder="Name on Aadhaar (e.g. RAHUL SHARMA)"
        value={name}
        onChange={(e) => setName(e.target.value.toUpperCase())}
      />
      <input
        className="input text-sm"
        placeholder="Birth year (e.g. 1995)"
        maxLength={4}
        value={year}
        onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))}
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        onClick={onRetry}
        disabled={loading || !name || year.length !== 4}
        className="btn-primary w-full text-sm"
      >
        {loading ? 'Verifying…' : 'Try Again →'}
      </button>
    </div>
  )
}
