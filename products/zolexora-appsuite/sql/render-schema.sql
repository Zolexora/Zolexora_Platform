-- Zolexora App Suite: Production Database Schema for Render PostgreSQL
-- Compatible with Native PostgreSQL 18 & @zolexora/user-auth-zolexora
-- Compliant with IT Act 2000, Indian Contract Act 1872 & Indian Evidence Act (Sec 65B)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. Authentication Tables (@zolexora/user-auth-zolexora)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.zolexora_auth_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zolexora_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_zolexora_auth_users_zx_id ON public.zolexora_auth_users(zolexora_id);
CREATE INDEX IF NOT EXISTS idx_zolexora_auth_users_email ON public.zolexora_auth_users(email);

CREATE TABLE IF NOT EXISTS public.zolexora_auth_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.zolexora_auth_users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify-email', 'reset-password')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_zolexora_auth_tokens_user ON public.zolexora_auth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_zolexora_auth_tokens_expiry ON public.zolexora_auth_tokens(expires_at);

CREATE TABLE IF NOT EXISTS public.zolexora_auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.zolexora_auth_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_zolexora_auth_sessions_user ON public.zolexora_auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_zolexora_auth_sessions_expiry ON public.zolexora_auth_sessions(expires_at);

-- ============================================================================
-- 2. App Requests Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.app_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.zolexora_auth_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  budget_range TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'in_review', 'contracted', 'in_development', 'delivered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_requests_user ON public.app_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_app_requests_status ON public.app_requests(status);

-- ============================================================================
-- 3. Contracts Table (Legal Cryptographic Hashing & e-Stamping details)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.app_requests(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.zolexora_auth_users(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_contracts_user ON public.contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_request ON public.contracts(request_id);

-- ============================================================================
-- 4. Contract Audit Logs (Section 65B Indian Evidence Act compliant)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.contract_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.zolexora_auth_users(id) ON DELETE SET NULL,
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('CREATED', 'VIEWED', 'DOWNLOADED', 'OTP_GENERATED', 'OTP_VERIFIED', 'SIGNED', 'DECLINED', 'STAMPED')),
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  verification_method TEXT NOT NULL, -- e.g. 'EMAIL_OTP', 'AADHAAR_OTP', 'SESSION_AUTH'
  document_hash_at_event TEXT, -- SHA-256
  metadata JSONB DEFAULT '{}'::jsonb, -- e.g. OTP session id, transaction id
  timestamp_utc TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contract_audit_logs_contract ON public.contract_audit_logs(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_audit_logs_timestamp ON public.contract_audit_logs(timestamp_utc);
