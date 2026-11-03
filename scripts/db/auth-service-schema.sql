-- ==============================================================================
-- ZOLEXORA PLATFORM — CENTRALIZED AUTH & IDENTITY SERVICE SCHEMA
-- ==============================================================================
-- Service: apps/zolexora-auth-service (Port 3081)
-- Target: PostgreSQL (Multi-tenant Auth & Platform Admin databases)
-- Description: Complete schema for Organization Tenancy, Scoped Employee
--              Memberships, Global User Identities, Platform Superadmins,
--              and Immutable Security Audit Logs.
-- ==============================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- Helper Functions & Triggers
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. Organizations Table (`zolexora_organizations`)
-- ------------------------------------------------------------------------------
-- Represents multi-tenant enterprise organizations (TMS, IMS, ERP).
-- Enforces canonical Crockford Base32 ID format: ZX-ORG-XXXX-XXXX-XXXX
CREATE TABLE IF NOT EXISTS public.zolexora_organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zolexora_org_id TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    slug            TEXT UNIQUE,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deactivated', 'pending')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_zolexora_org_id_format
      CHECK (zolexora_org_id ~* '^ZX-ORG-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$')
);

-- Fast lookup B-tree indexes for organizations
CREATE INDEX IF NOT EXISTS idx_zolexora_orgs_zolexora_org_id 
    ON public.zolexora_organizations(zolexora_org_id);
CREATE INDEX IF NOT EXISTS idx_zolexora_orgs_slug 
    ON public.zolexora_organizations(slug);
CREATE INDEX IF NOT EXISTS idx_zolexora_orgs_status 
    ON public.zolexora_organizations(status);

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS trg_zolexora_organizations_updated_at ON public.zolexora_organizations;
CREATE TRIGGER trg_zolexora_organizations_updated_at
    BEFORE UPDATE ON public.zolexora_organizations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 2. Organization Memberships Table (`zolexora_organization_memberships`)
-- ------------------------------------------------------------------------------
-- Represents employee accounts scoped to a specific organization (Track 2).
-- Passwords hashed via Argon2id or Scrypt. Webmail domains strictly blocked.
CREATE TABLE IF NOT EXISTS public.zolexora_organization_memberships (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.zolexora_organizations(id) ON DELETE CASCADE,
    zolexora_id     TEXT NOT NULL,
    email           TEXT NOT NULL CHECK (email = lower(email)),
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'member',
    permissions     JSONB NOT NULL DEFAULT '[]'::jsonb,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deactivated', 'pending')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_org_memberships_org_email UNIQUE(organization_id, email),
    CONSTRAINT uq_org_memberships_org_zx_id UNIQUE(organization_id, zolexora_id),
    CONSTRAINT chk_org_memberships_zx_id_format
      CHECK (zolexora_id ~* '^ZX-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$')
);

-- Fast lookup B-tree indexes for employee memberships
CREATE INDEX IF NOT EXISTS idx_org_memberships_organization_id 
    ON public.zolexora_organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_zolexora_id 
    ON public.zolexora_organization_memberships(zolexora_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_email 
    ON public.zolexora_organization_memberships(email);
CREATE INDEX IF NOT EXISTS idx_org_memberships_status 
    ON public.zolexora_organization_memberships(status);

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS trg_zolexora_org_memberships_updated_at ON public.zolexora_organization_memberships;
CREATE TRIGGER trg_zolexora_org_memberships_updated_at
    BEFORE UPDATE ON public.zolexora_organization_memberships
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 3. Global Auth Users Table (`zolexora_auth_users`)
-- ------------------------------------------------------------------------------
-- Represents global user-centric accounts across the platform (Track 1).
-- Authenticated via Firebase Authentication or standalone credentials.
CREATE TABLE IF NOT EXISTS public.zolexora_auth_users (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zolexora_id       TEXT UNIQUE NOT NULL,
    email             TEXT UNIQUE CHECK (email IS NULL OR email = lower(email)),
    phone_number      TEXT UNIQUE CHECK (phone_number IS NULL OR phone_number ~ '^\+[1-9][0-9]{7,14}$'),
    display_name      TEXT,
    firebase_uid      TEXT UNIQUE,
    password_hash     TEXT,
    status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deactivated', 'pending')),
    email_verified_at TIMESTAMPTZ,
    phone_verified_at TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_auth_users_zx_id_format
      CHECK (zolexora_id ~* '^ZX-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$')
);

-- Fast lookup B-tree indexes for global auth users
CREATE INDEX IF NOT EXISTS idx_zolexora_auth_users_zolexora_id 
    ON public.zolexora_auth_users(zolexora_id);
CREATE INDEX IF NOT EXISTS idx_zolexora_auth_users_email 
    ON public.zolexora_auth_users(email);
CREATE INDEX IF NOT EXISTS idx_zolexora_auth_users_phone 
    ON public.zolexora_auth_users(phone_number);
CREATE INDEX IF NOT EXISTS idx_zolexora_auth_users_status 
    ON public.zolexora_auth_users(status);

-- ------------------------------------------------------------------------------
-- 4. Platform Admin Users Table (`platform_admin_users`)
-- ------------------------------------------------------------------------------
-- Represents internal platform staff and superadmins (Track 3).
-- Managed exclusively via platform admin control plane; no public self-registration.
CREATE TABLE IF NOT EXISTS public.platform_admin_users (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zolexora_id       TEXT UNIQUE NOT NULL,
    username          TEXT UNIQUE NOT NULL,
    email             TEXT UNIQUE NOT NULL CHECK (email = lower(email)),
    password_hash     TEXT NOT NULL,
    role              TEXT NOT NULL DEFAULT 'superadmin',
    permissions       JSONB NOT NULL DEFAULT '["*"]'::jsonb,
    is_platform_admin BOOLEAN NOT NULL DEFAULT TRUE,
    status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deactivated')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup B-tree indexes for platform admin users
CREATE INDEX IF NOT EXISTS idx_platform_admin_users_zolexora_id 
    ON public.platform_admin_users(zolexora_id);
CREATE INDEX IF NOT EXISTS idx_platform_admin_users_username 
    ON public.platform_admin_users(username);
CREATE INDEX IF NOT EXISTS idx_platform_admin_users_email 
    ON public.platform_admin_users(email);
CREATE INDEX IF NOT EXISTS idx_platform_admin_users_status 
    ON public.platform_admin_users(status);

-- ------------------------------------------------------------------------------
-- 5. Audit Logs Table (`zolexora_auth_audit_logs`)
-- ------------------------------------------------------------------------------
-- Append-only security audit log recording login attempts, credential changes,
-- and administrative actions across all authentication tracks.
CREATE TABLE IF NOT EXISTS public.zolexora_auth_audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id    TEXT,
    action      TEXT NOT NULL,
    target_id   TEXT,
    details     JSONB,
    ip_address  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup B-tree indexes for security audit logs
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_actor 
    ON public.zolexora_auth_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_action 
    ON public.zolexora_auth_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_target 
    ON public.zolexora_auth_audit_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_created_at 
    ON public.zolexora_auth_audit_logs(created_at);

-- ------------------------------------------------------------------------------
-- 6. Token Revocations Table (`auth_revocations`)
-- ------------------------------------------------------------------------------
-- Persistent store for revoked sessions, user-wide token invalidation timestamps,
-- and single-token blacklisting.
CREATE TABLE IF NOT EXISTS public.auth_revocations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_id       TEXT NOT NULL,
    revocation_type TEXT NOT NULL DEFAULT 'user_all_tokens' 
                    CHECK (revocation_type IN ('user_all_tokens', 'single_token')),
    revoked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason          TEXT,
    actor_id        TEXT,
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup B-tree indexes for revocations
CREATE INDEX IF NOT EXISTS idx_auth_revocations_target_id 
    ON public.auth_revocations(target_id);
CREATE INDEX IF NOT EXISTS idx_auth_revocations_revoked_at 
    ON public.auth_revocations(revoked_at);
CREATE INDEX IF NOT EXISTS idx_auth_revocations_expires_at 
    ON public.auth_revocations(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_revocations_target_revoked 
    ON public.auth_revocations(target_id, revoked_at DESC);

-- ------------------------------------------------------------------------------
-- 7. Private KYC Documents Table (`zolexora_kyc_documents`)
-- ------------------------------------------------------------------------------
-- Persistent metadata registry for encrypted/private KYC documents.
-- Storage key follows: kyc/{org_id}/{user_id}/{document_id}.{ext}
CREATE TABLE IF NOT EXISTS public.zolexora_kyc_documents (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id    TEXT UNIQUE NOT NULL,
    user_id        TEXT NOT NULL,
    owner_id       TEXT NOT NULL,
    org_id         TEXT,
    document_type  TEXT NOT NULL DEFAULT 'id_document',
    storage_key    TEXT UNIQUE NOT NULL,
    file_size      INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
    mime_type      TEXT NOT NULL CHECK (mime_type IN ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_docs_doc_id ON public.zolexora_kyc_documents(document_id);
CREATE INDEX IF NOT EXISTS idx_kyc_docs_user_id ON public.zolexora_kyc_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_docs_owner_id ON public.zolexora_kyc_documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_kyc_docs_org_id ON public.zolexora_kyc_documents(org_id);
CREATE INDEX IF NOT EXISTS idx_kyc_docs_created_at ON public.zolexora_kyc_documents(created_at);

DROP TRIGGER IF EXISTS trg_zolexora_kyc_docs_updated_at ON public.zolexora_kyc_documents;
CREATE TRIGGER trg_zolexora_kyc_docs_updated_at
    BEFORE UPDATE ON public.zolexora_kyc_documents
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ------------------------------------------------------------------------------
-- 8. One-Time Codes Table (`zolexora_auth_otps`)
-- ------------------------------------------------------------------------------
-- Signup verification and password reset codes. Only an HMAC of the code is stored.
-- `payload` holds the pending signup data (password hash, phone, generated ZX ID).
CREATE TABLE IF NOT EXISTS public.zolexora_auth_otps (
    email       TEXT NOT NULL CHECK (email = lower(email)),
    purpose     TEXT NOT NULL CHECK (purpose IN ('signup', 'reset')),
    code_hash   TEXT NOT NULL,
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    attempts    INTEGER NOT NULL DEFAULT 0,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (email, purpose)
);

CREATE INDEX IF NOT EXISTS idx_auth_otps_expires_at ON public.zolexora_auth_otps(expires_at);
