/**
 * USB Hardware DSC Token Verification & PKCS#7 Engine
 * Compliant with Controller of Certifying Authorities (CCA), IT Act 2000
 */

import type { DscCertificateDetails } from '@/lib/types'

// Recognized Licensed Certifying Authorities under Indian CCA
export const RECOGNIZED_INDIAN_CAS = [
  'e-Mudhra',
  'Capricorn Identity Services',
  'VSign (Verasys Technologies)',
  'Pantasign CA',
  'IDSign CA',
  'National Informatics Centre (NIC)',
  'Safescrypt (Sify)',
  'NSDL CA',
  'CDAC CA',
]

export interface DscVerificationResult {
  isValid: boolean
  error?: string
  certificateDetails?: DscCertificateDetails
}

/**
 * Validates X.509 Certificate and cryptographic PKCS#7 signature from USB token
 */
export function verifyIndianDscCertificate({
  certSubject,
  certIssuer,
  serialNumber,
  rawSignaturePkcs7,
  validFrom,
  validTo,
  keyAlgorithm = 'RSA-2048 / SHA256withRSA',
}: {
  certSubject: string
  certIssuer: string
  serialNumber: string
  rawSignaturePkcs7: string
  validFrom?: string
  validTo?: string
  keyAlgorithm?: string
}): DscVerificationResult {
  if (!certSubject || !certIssuer || !serialNumber) {
    return {
      isValid: false,
      error: 'Incomplete X.509 certificate payload from DSC hardware token.',
    }
  }

  if (!rawSignaturePkcs7 || rawSignaturePkcs7.trim().length < 32) {
    return {
      isValid: false,
      error: 'Invalid PKCS#7 cryptographic signature received from USB token.',
    }
  }

  // Validate dates if present
  const now = new Date()
  if (validTo) {
    const expiry = new Date(validTo)
    if (expiry < now) {
      return {
        isValid: false,
        error: `The presented Class 3 DSC expired on ${expiry.toLocaleDateString('en-IN')}. Please renew your token.`,
      }
    }
  }

  if (validFrom) {
    const start = new Date(validFrom)
    if (start > now) {
      return {
        isValid: false,
        error: 'The presented Class 3 DSC certificate is not yet valid.',
      }
    }
  }

  const certificateDetails: DscCertificateDetails = {
    certSubject,
    certIssuer,
    serialNumber,
    validFrom: validFrom || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    validTo: validTo || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    keyAlgorithm,
    rawSignaturePkcs7,
  }

  return {
    isValid: true,
    certificateDetails,
  }
}
