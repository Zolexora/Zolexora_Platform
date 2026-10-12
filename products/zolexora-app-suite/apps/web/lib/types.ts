export type RequestStatus =
  | 'submitted'
  | 'in_review'
  | 'contracted'
  | 'in_development'
  | 'delivered'

export type ContractStatus = 'draft' | 'sent' | 'signed' | 'declined'

export type ContractType = 'MSA' | 'SOW' | 'NDA' | 'AMC'

export type SigningMode = 'CLICKWRAP_OTP' | 'AADHAAR_ESIGN' | 'DSC_TOKEN'

export type AuditAction =
  | 'CREATED'
  | 'VIEWED'
  | 'DOWNLOADED'
  | 'OTP_GENERATED'
  | 'OTP_VERIFIED'
  | 'DSC_INITIATED'
  | 'DSC_VERIFIED'
  | 'SIGNED'
  | 'DECLINED'
  | 'STAMPED'

export interface DscCertificateDetails {
  certSubject: string // e.g. CN=John Doe, O=Acme Corp, C=IN
  certIssuer: string // e.g. (CCA CA) eMudhra / Capricorn / VSign / Pantasign
  serialNumber: string
  validFrom: string
  validTo: string
  keyAlgorithm: string
  rawSignaturePkcs7: string // Base64 encoded cryptographic signature
}

export interface AppRequest {
  id: string
  user_id: string
  title: string
  description: string
  budget_range: string | null
  category: string | null
  status: RequestStatus
  created_at: string
  updated_at: string
}

export interface Contract {
  id: string
  request_id: string | null
  user_id: string
  title: string
  contract_type: ContractType
  document_url: string | null
  document_hash: string | null
  signed_document_hash: string | null
  stamp_duty_ref: string | null
  stamp_state: string | null
  signing_mode: SigningMode
  dsc_details?: DscCertificateDetails | null
  status: ContractStatus
  scope_summary: string | null
  total_value_inr: number | null
  signed_at: string | null
  created_at: string
  updated_at: string
}

export interface ContractAuditLog {
  id: string
  contract_id: string
  user_id: string | null
  signer_name: string
  signer_email: string
  action: AuditAction
  ip_address: string
  user_agent: string
  verification_method: string
  document_hash_at_event: string | null
  metadata: Record<string, unknown>
  timestamp_utc: string
}

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  submitted: 'Submitted',
  in_review: 'In Review',
  contracted: 'Contracted',
  in_development: 'In Development',
  delivered: 'Delivered',
}

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: 'Draft',
  sent: 'Sent for Review',
  signed: 'Signed & Legally Executed',
  declined: 'Declined',
}

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  MSA: 'Master Services Agreement (MSA)',
  SOW: 'Statement of Work (SOW)',
  NDA: 'Non-Disclosure Agreement (NDA)',
  AMC: 'Annual Maintenance Contract (AMC)',
}

export const BUDGET_RANGES = [
  '< ₹50,000',
  '₹50,000 – ₹2,00,000',
  '₹2,00,000 – ₹5,00,000',
  '₹5,00,000 – ₹10,00,000',
  '> ₹10,00,000',
  "Let's discuss",
] as const

export const APP_CATEGORIES = [
  'Web Application',
  'Mobile App (Android)',
  'Mobile App (iOS)',
  'Mobile App (Cross-platform)',
  'Admin Dashboard / CMS',
  'E-Commerce Platform',
  'SaaS Product',
  'API / Backend Service',
  'AI / ML Integration',
  'Other',
] as const
