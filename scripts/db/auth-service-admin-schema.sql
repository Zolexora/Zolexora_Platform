-- ==============================================================================
-- ADMIN DATABASE (ADMIN_DATABASE_URL / ZOLEXORA_AUTHENTICATION_INTERNAL_DATABASE_URL)
-- Only the platform admin table lives here. Safe to re-run.
-- Admins are never created through the API: insert them directly with a scrypt hash.
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

CREATE INDEX IF NOT EXISTS idx_platform_admin_users_status ON public.platform_admin_users(status);
