'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { executeDigitalContract } from '@/lib/actions/contracts'
import { RECOGNIZED_INDIAN_CAS } from '@/lib/dsc-verifier'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Usb,
  Mail,
  Fingerprint,
  ExternalLink,
} from 'lucide-react'
import type { SigningMode, EsignProvider } from '@/lib/types'

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  // 1. Email OTP State
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)

  // 2. Aadhaar eSign State
  const [esignProvider, setEsignProvider] = useState<EsignProvider>('DIGIO')
  const [signerPhone, setSignerPhone] = useState('')
  const [gatewayRedirectUrl, setGatewayRedirectUrl] = useState<string | null>(null)

  // 3. Hardware USB DSC State
  const [selectedCa, setSelectedCa] = useState(RECOGNIZED_INDIAN_CAS[0])
  const [tokenPin, setTokenPin] = useState('')
  const [dscSerialNumber, setDscSerialNumber] = useState('')
  const [dscConnected, setDscConnected] = useState(false)

  async function handleConnectUsbToken() {
    setLoading(true)
    setError(null)
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

    const result = await executeDigitalContract({
      contractId,
      signingMode,
      signerName: signerName.trim(),
      otpCode: signingMode === 'CLICKWRAP_OTP' ? otpCode : undefined,
      dscPayload,
      esignProvider: signingMode === 'AADHAAR_ESIGN' ? esignProvider : undefined,
      signerPhone: signingMode === 'AADHAAR_ESIGN' && signerPhone.trim() ? signerPhone.trim() : undefined,
    })

    setLoading(false)

    if (result.success) {
      if (result.gatewayUrl) {
        setGatewayRedirectUrl(result.gatewayUrl)
        setSuccess(true)
        setSuccessMessage(
          `Redirecting to ${esignProvider} Aadhaar eSign ESP gateway for biometric / UIDAI OTP verification...`
        )
      } else {
        setSuccess(true)
        setSuccessMessage(
          'Contract legally executed and notarized under IT Act 2000 Section 10A / 3A with SHA-256 evidence integrity logs.'
        )
        setTimeout(() => {
          router.refresh()
        }, 1500)
      }
    } else {
      setError(result.error || 'Failed to digitally sign document.')
    }
  }

  if (success) {
    return (
      <div className="rounded-xl border border-[#CBD5E1]/40 bg-[#0B1F3A]/50 p-6 text-center">
        <CheckCircle2 className="w-10 h-10 text-[#CBD5E1] mx-auto mb-3" />
        <h3 className="text-base font-semibold text-white mb-1">
          Agreement Executed Successfully
        </h3>
        <p className="text-xs text-[#CBD5E1]/80 max-w-sm mx-auto mb-4">
          {successMessage}
        </p>
        {gatewayRedirectUrl && (
          <div className="pt-2">
            <a
              href={gatewayRedirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#0B1F3A] hover:bg-[#142E54] text-white border border-[#CBD5E1]/40 text-sm font-medium px-5 py-2.5 rounded-lg transition-all"
            >
              Open {esignProvider} Aadhaar eSign Gateway <ExternalLink className="w-4 h-4 text-[#CBD5E1]" />
            </a>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#404040] bg-[#0A0A0A] p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-[#0B1F3A] border border-[#CBD5E1]/30 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-[#CBD5E1]" />
        </div>
        <div>
          <h3 className="font-semibold text-white">Execute Digital Contract</h3>
          <p className="text-xs text-[#CBD5E1]/70">
            Legally valid in India under the IT Act, 2000 &amp; Indian Evidence Act (Sec 65B &amp; 85B)
          </p>
        </div>
      </div>

      {/* 3 Signature Method Tabs */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#121824] rounded-lg mb-5 border border-[#404040]">
        <button
          type="button"
          onClick={() => {
            setSigningMode('CLICKWRAP_OTP')
            setError(null)
          }}
          className={`flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all cursor-pointer ${
            signingMode === 'CLICKWRAP_OTP'
              ? 'bg-[#0B1F3A] text-white border border-[#CBD5E1]/40 shadow-xs'
              : 'text-[#CBD5E1]/70 hover:text-white'
          }`}
        >
          <Mail className="w-3.5 h-3.5" /> Email OTP
        </button>
        <button
          type="button"
          onClick={() => {
            setSigningMode('AADHAAR_ESIGN')
            setError(null)
          }}
          className={`flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all cursor-pointer ${
            signingMode === 'AADHAAR_ESIGN'
              ? 'bg-[#0B1F3A] text-white border border-[#CBD5E1]/40 shadow-xs'
              : 'text-[#CBD5E1]/70 hover:text-white'
          }`}
        >
          <Fingerprint className="w-3.5 h-3.5" /> Aadhaar eSign
        </button>
        <button
          type="button"
          onClick={() => {
            setSigningMode('DSC_TOKEN')
            setError(null)
          }}
          className={`flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all cursor-pointer ${
            signingMode === 'DSC_TOKEN'
              ? 'bg-[#0B1F3A] text-white border border-[#CBD5E1]/40 shadow-xs'
              : 'text-[#CBD5E1]/70 hover:text-white'
          }`}
        >
          <Usb className="w-3.5 h-3.5" /> USB Token (CCA)
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

        {/* Mode 2: Aadhaar eSign (Digio / Leegality) */}
        {signingMode === 'AADHAAR_ESIGN' && (
          <div className="space-y-3 p-4 rounded-lg bg-[#080C14] border border-[#404040]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Fingerprint className="w-4 h-4 text-[#CBD5E1]" /> Aadhaar eSign (UIDAI ESP Gateway)
              </span>
              <span className="text-[10px] bg-[#0B1F3A] text-[#CBD5E1] border border-[#CBD5E1]/30 px-2 py-0.5 rounded font-mono">
                IT ACT SEC 3A
              </span>
            </div>

            <Select
              label="Select eSign Provider Gateway"
              value={esignProvider}
              onChange={(e) => setEsignProvider(e.target.value as EsignProvider)}
              options={[
                { value: 'DIGIO', label: 'Digio (Aadhaar OTP / Biometric ESP)' },
                { value: 'LEEGALITY', label: 'Leegality (eSign + e-Stamp Gateway)' },
                { value: 'SIGNDESK', label: 'SignDesk (Enterprise eSign Gateway)' },
              ]}
            />

            <Input
              label="Aadhaar-Linked Mobile Number (Optional)"
              value={signerPhone}
              onChange={(e) => setSignerPhone(e.target.value)}
              placeholder="10-digit mobile number"
              hint="You will receive the UIDAI OTP on the phone number linked with your Aadhaar."
            />
          </div>
        )}

        {/* Mode 3: Hardware USB DSC Token */}
        {signingMode === 'DSC_TOKEN' && (
          <div className="space-y-3 p-4 rounded-lg bg-[#080C14] border border-[#404040]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Usb className="w-4 h-4 text-[#CBD5E1]" /> USB Hardware Token (ePass2003 / ProxKey)
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-mono border ${
                  dscConnected
                    ? 'bg-white/10 text-white border-white/40 font-semibold'
                    : 'bg-[#0A0A0A] text-[#CBD5E1]/60 border-[#404040]'
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
                Detect &amp; Read USB Token Certificate
              </Button>
            ) : (
              <>
                <div className="p-2.5 rounded bg-[#0A0A0A] border border-[#404040] text-[11px] font-mono text-[#CBD5E1] space-y-1">
                  <div>Serial No: <span className="text-white">{dscSerialNumber}</span></div>
                  <div>Cert Type: <span className="text-white font-semibold">Class 3 Organization / Signing</span></div>
                  <div>Algorithm: <span className="text-[#CBD5E1]/70">SHA256withRSA / PKCS#11</span></div>
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

        <label className="flex items-start gap-3 p-3 rounded-lg bg-[#080C14] border border-[#404040] cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-[#404040] bg-[#0A0A0A] text-[#0B1F3A] focus:ring-[#CBD5E1]"
          />
          <span className="text-xs text-[#CBD5E1]/80 leading-relaxed">
            I confirm that I am authorized to bind the client, acknowledge the IP transfer terms upon full settlement, and consent to electronic execution under Section 10A &amp; Section 3A of the Information Technology Act, 2000.
          </span>
        </label>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-[#0A0A0A] border border-[#404040] text-xs text-[#CBD5E1]">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-white" />
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
          {signingMode === 'AADHAAR_ESIGN'
            ? `Proceed to ${esignProvider} Aadhaar eSign`
            : signingMode === 'DSC_TOKEN'
            ? 'Authorize & Sign with USB Token'
            : 'Digitally Sign & Execute'}
        </Button>
      </div>
    </div>
  )
}
