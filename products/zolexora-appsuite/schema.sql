-- Zolexora App Suite: Database Schema & Row Level Security (RLS)
-- Legally compliant with IT Act 2000, Indian Contract Act 1872 & Indian Evidence Act (Sec 65B)

-- 1. App Requests Table
CREATE TABLE IF NOT EXISTS public.app_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  budget_range TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'in_review', 'contracted', 'in_development', 'delivered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Contracts Table with Legal Cryptographic Hashing & Indian Stamp Duty details
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.app_requests(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  contract_type TEXT NOT NULL DEFAULT 'MSA' CHECK (contract_type IN ('MSA', 'SOW', 'NDA', 'AMC')),
  document_url TEXT,
  document_hash TEXT, -- SHA-256 hash of original document
  signed_document_hash TEXT, -- SHA-256 hash of signed document
  stamp_duty_ref TEXT, -- e-Stamp Certificate Number if stamped (NeSL / State e-Stamp)
  stamp_state TEXT DEFAULT 'MAHARASHTRA',
  signing_mode TEXT DEFAULT 'CLICKWRAP_OTP' CHECK (signing_mode IN ('CLICKWRAP_OTP', 'AADHAAR_ESIGN', 'DSC_TOKEN')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'declined')),
  scope_summary TEXT,
  total_value_inr NUMERIC(12, 2) DEFAULT 0.00,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Contract Audit Logs (Section 65B Indian Evidence Act compliant)
CREATE TABLE IF NOT EXISTS public.contract_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('CREATED', 'VIEWED', 'DOWNLOADED', 'OTP_GENERATED', 'OTP_VERIFIED', 'SIGNED', 'DECLINED', 'STAMPED')),
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  verification_method TEXT NOT NULL, -- e.g. 'EMAIL_OTP', 'AADHAAR_OTP', 'SESSION_AUTH'
  document_hash_at_event TEXT, -- SHA-256
  metadata JSONB DEFAULT '{}'::jsonb, -- e.g. OTP session id, Leegality/Digio transaction id
  timestamp_utc TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices for performance & legal audit trails
CREATE INDEX IF NOT EXISTS idx_app_requests_user ON public.app_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_app_requests_status ON public.app_requests(status);
CREATE INDEX IF NOT EXISTS idx_contracts_user ON public.contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_request ON public.contracts(request_id);
CREATE INDEX IF NOT EXISTS idx_contract_audit_logs_contract ON public.contract_audit_logs(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_audit_logs_timestamp ON public.contract_audit_logs(timestamp_utc);

-- Enable RLS
ALTER TABLE public.app_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_audit_logs ENABLE ROW LEVEL SECURITY;

-- App Requests Policies
CREATE POLICY "Users can view their own requests"
  ON public.app_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own requests"
  ON public.app_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending requests"
  ON public.app_requests FOR UPDATE
  USING (auth.uid() = user_id AND status = 'submitted');

-- Contracts Policies
CREATE POLICY "Users can view their own contracts"
  ON public.contracts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can sign their own contracts"
  ON public.contracts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Audit Logs Policies:
-- Users can view the audit log trail of their own contracts (read-only for clients, system inserts)
CREATE POLICY "Users can view audit trails of their contracts"
  ON public.contract_audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = contract_audit_logs.contract_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can append signature audit entries to their contracts"
  ON public.contract_audit_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = contract_audit_logs.contract_id
      AND c.user_id = auth.uid()
    )
  );
