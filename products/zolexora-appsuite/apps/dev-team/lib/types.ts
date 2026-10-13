export type RequestStatus =
  | 'submitted'
  | 'in_review'
  | 'contracted'
  | 'in_development'
  | 'delivered'

export type ContractStatus = 'draft' | 'sent' | 'signed' | 'declined'

export type ContractType = 'MSA' | 'SOW' | 'NDA' | 'AMC'

export type SigningMode = 'CLICKWRAP_OTP' | 'AADHAAR_ESIGN' | 'DSC_TOKEN'

export interface AppRequest {
  id: string
  user_id: string
  user_email?: string
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
  user_email?: string
  title: string
  contract_type: ContractType
  document_url: string | null
  document_hash: string | null
  signed_document_hash: string | null
  stamp_duty_ref: string | null
  stamp_state: string | null
  signing_mode: SigningMode
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
  action: string
  ip_address: string
  user_agent: string
  verification_method: string
  document_hash_at_event: string | null
  metadata: Record<string, unknown>
  timestamp_utc: string
}

export interface ClientUser {
  id: string
  email: string
  email_verified_at: string | null
  created_at?: string
  total_requests?: number
  total_contracts?: number
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
  sent: 'Sent to Client',
  signed: 'Signed & Executed',
  declined: 'Declined',
}

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  MSA: 'Master Services Agreement (MSA)',
  SOW: 'Statement of Work (SOW)',
  NDA: 'Non-Disclosure Agreement (NDA)',
  AMC: 'Annual Maintenance Contract (AMC)',
}

export const INDIAN_STATES = [
  'Maharashtra',
  'Karnataka',
  'Delhi (NCT)',
  'Telangana',
  'Tamil Nadu',
  'Gujarat',
  'Uttar Pradesh',
  'Haryana',
  'West Bengal',
  'Rajasthan',
] as const
