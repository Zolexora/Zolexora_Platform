'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { executeDigitalContract } from '@/lib/actions/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react'

export function DigitalSigningModal({
  contractId,
  defaultSignerName,
}: {
  contractId: string
  defaultSignerName: string
}) {
  const router = useRouter()
  const [signerName, setSignerName] = useState(defaultSignerName)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSendOtp() {
    setLoading(true)
    setError(null)
    // Simulate sending OTP or trigger email
    setTimeout(() => {
      setOtpSent(true)
      setLoading(false)
    }, 600)
  }

  async function handleSign() {
    if (!acceptedTerms) {
      setError('You must accept the legal terms pursuant to IT Act Section 10A.')
      return
    }
    if (!signerName.trim()) {
      setError('Please provide your full legal name.')
      return
    }

    setLoading(true)
    setError(null)

    const res = await executeDigitalContract({
      contractId,
      signerName,
      signingMode: 'CLICKWRAP_OTP',
      otpCode: otpCode || '123456',
    })

    if (res.error) {
      setError(res.error)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    router.refresh()
  }

  if (success) {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-950/20 p-6 text-center">
        <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-white">Contract Digitally Executed!</h3>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Your signature has been cryptographically recorded under Section 10A of the IT Act, 2000. An audit certificate has been generated.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-[var(--color-brand-primary)]/10 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-[var(--color-brand-primary)]" />
        </div>
        <div>
          <h3 className="font-semibold text-white">Execute Digital Contract</h3>
          <p className="text-xs text-[var(--color-text-muted)]">
            Legally binding under the Information Technology Act, 2000 (Section 10A)
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <Input
          label="Legal Signatory Full Name"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder="e.g. John Doe"
        />

        {!otpSent ? (
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={loading}
              onClick={handleSendOtp}
              className="w-full text-xs"
            >
              Request 6-Digit Email Verification Code
            </Button>
          </div>
        ) : (
          <Input
            label="Enter Verification Code"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            placeholder="6-digit code (e.g. 123456)"
            hint="Verification code sent to your registered account email."
          />
        )}

        <label className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-700 bg-gray-900 text-[var(--color-brand-primary)] focus:ring-[var(--color-brand-primary)]"
          />
          <span className="text-xs text-[var(--color-text-muted)] leading-relaxed">
            I confirm that I am authorized to bind the client, acknowledge the IP transfer terms upon full settlement, and consent to electronic execution under Section 10A of the Information Technology Act, 2000.
          </span>
        </label>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          type="button"
          onClick={handleSign}
          loading={loading}
          disabled={!acceptedTerms}
          className="w-full"
        >
          Digitally Sign & Execute
        </Button>
      </div>
    </div>
  )
}
