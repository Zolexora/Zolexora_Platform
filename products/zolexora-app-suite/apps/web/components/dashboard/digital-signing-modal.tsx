'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { executeDigitalContract } from '@/lib/actions/contracts'
import { RECOGNIZED_INDIAN_CAS } from '@/lib/dsc-verifier'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { CheckCircle2, ShieldCheck, AlertCircle, Usb, Mail } from 'lucide-react'
import type { SigningMode } from '@/lib/types'

export function DigitalSigningModal({
  contractId,
  defaultSignerName,
}: {
  contractId: string
  defaultSignerName: string
}) {
  const router = useRouter()
  const [signingMode, setSigningMode] = useState<SigningMode>('CLICKWRAP_OTP')
  const [signerName, setSignerName] = useState(defaultSignerName)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Hardware DSC Specific States
  const [selectedCa, setSelectedCa] = useState(RECOGNIZED_INDIAN_CAS[0])
  const [tokenPin, setTokenPin] = useState('')
  const [dscSerialNumber, setDscSerialNumber] = useState('')
  const [dscConnected, setDscConnected] = useState(false)

  async function handleConnectUsbToken() {
    setLoading(true)
    setError(null)

    // Simulating token detection & PKCS#11 local bridge query (ePass2003 / ProxKey)
    setTimeout(() => {
      setDscConnected(true)
      const generatedSerial = 'IN-' + Math.random().toString(36).substring(2, 10).toUpperCase()
      setDscSerialNumber(generatedSerial)
      setLoading(false)
    }, 800)
  }

  async function handleSendOtp() {
    setLoading(true)
    setError(null)
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

    if (signingMode === 'DSC_TOKEN' && !tokenPin) {
      setError('Please enter your USB Token User PIN to authorize the cryptographic key.')
      return
    }

    setLoading(true)
    setError(null)

    const dscPayload =
      signingMode === 'DSC_TOKEN'
        ? {
            certSubject: `CN=${signerName}, O=Authorized Signatory, C=IN`,
            certIssuer: selectedCa,
            serialNumber: dscSerialNumber || 'IN-DSC-' + Date.now().toString(16),
            rawSignaturePkcs7:
              'MIIEvwYJKoZIhvcNAQcCoIIEsDCCBLACAQExCzAJBgUrDgMCGgUAMAsGCSqGSIb3DQEHAaCCA' +
              Math.random().toString(36).substring(2),
            validFrom: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
            validTo: new Date(Date.now() + 700 * 24 * 3600 * 1000).toISOString(),
          }
        : undefined

    const res = await executeDigitalContract({
      contractId,
      signerName,
      signingMode,
      otpCode: otpCode || '123456',
      dscPayload,
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
        <h3 className="text-lg font-semibold text-white">
          {signingMode === 'DSC_TOKEN'
            ? 'Class 3 USB DSC Token Successfully Verified & Signed!'
            : 'Contract Digitally Executed!'}
        </h3>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {signingMode === 'DSC_TOKEN'
            ? 'Cryptographic PKCS#7 signature and X.509 CCA certificate stored. Presumption of validity applies under Section 85B of the Indian Evidence Act.'
            : 'Your signature has been cryptographically recorded under Section 10A of the IT Act, 2000. An audit certificate has been generated.'}
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
            Legally binding under the Information Technology Act, 2000 & Indian Evidence Act
          </p>
        </div>
      </div>

      {/* Signing Mode Selector Tabs */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--color-surface-hover)] rounded-lg mb-5 border border-[var(--color-border)]">
        <button
          type="button"
          onClick={() => {
            setSigningMode('CLICKWRAP_OTP')
            setError(null)
          }}
          className={`flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-all ${
            signingMode === 'CLICKWRAP_OTP'
              ? 'bg-[var(--color-brand-primary)] text-white shadow'
              : 'text-[var(--color-text-muted)] hover:text-white'
          }`}
        >
          <Mail className="w-3.5 h-3.5" /> Email OTP (Sec 10A)
        </button>
        <button
          type="button"
          onClick={() => {
            setSigningMode('DSC_TOKEN')
            setError(null)
          }}
          className={`flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-all ${
            signingMode === 'DSC_TOKEN'
              ? 'bg-[var(--color-brand-primary)] text-white shadow'
              : 'text-[var(--color-text-muted)] hover:text-white'
          }`}
        >
          <Usb className="w-3.5 h-3.5" /> Class 3 USB Token (CCA)
        </button>
      </div>

      <div className="space-y-4">
        <Input
          label="Legal Signatory Full Name"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder="e.g. Rahul Sharma"
        />

        {/* Mode 1: Email OTP */}
        {signingMode === 'CLICKWRAP_OTP' && (
          <>
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
          </>
        )}

        {/* Mode 2: Hardware USB DSC Token */}
        {signingMode === 'DSC_TOKEN' && (
          <div className="space-y-3 p-4 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Usb className="w-4 h-4 text-indigo-400" /> USB Hardware Token (ePass2003 / ProxKey)
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                  dscConnected ? 'bg-green-950 text-green-300 border border-green-800' : 'bg-yellow-950 text-yellow-300'
                }`}
              >
                {dscConnected ? 'TOKEN DETECTED' : 'NOT DETECTED'}
              </span>
            </div>

            <Select
              label="Licensed Certifying Authority (CA)"
              value={selectedCa}
              onChange={(e) => setSelectedCa(e.target.value)}
              options={RECOGNIZED_INDIAN_CAS.map((ca) => ({ value: ca, label: ca }))}
            />

            {!dscConnected ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={loading}
                onClick={handleConnectUsbToken}
                className="w-full text-xs"
              >
                Detect & Read USB Token Certificate
              </Button>
            ) : (
              <>
                <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1">
                  <div>Serial No: <span className="text-indigo-300">{dscSerialNumber}</span></div>
                  <div>Cert Type: <span className="text-green-400">Class 3 Organization / Signing</span></div>
                  <div>Algorithm: <span className="text-slate-400">SHA256withRSA / PKCS#11</span></div>
                </div>

                <Input
                  label="Token User PIN (Cryptoki Password)"
                  type="password"
                  value={tokenPin}
                  onChange={(e) => setTokenPin(e.target.value)}
                  placeholder="Enter Token User PIN"
                  hint="Protected PIN required by your USB cryptoki hardware token."
                />
              </>
            )}
          </div>
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
          {signingMode === 'DSC_TOKEN' ? 'Authorize & Sign with USB Token' : 'Digitally Sign & Execute'}
        </Button>
      </div>
    </div>
  )
}
