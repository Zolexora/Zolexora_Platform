export type RequestStatus =
  | 'submitted'
  | 'in_review'
  | 'contracted'
  | 'in_development'
  | 'delivered'

export type ContractStatus = 'draft' | 'sent' | 'signed' | 'declined'

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
  document_url: string | null
  status: ContractStatus
  signed_at: string | null
  created_at: string
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
  signed: 'Signed',
  declined: 'Declined',
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
