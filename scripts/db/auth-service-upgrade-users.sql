-- ==============================================================================
-- AUTH DATABASE (AUTH_DATABASE_URL / ZOLEXORA_AUTHENTICATION_DATABASE_URL)
-- One-time upgrade of a pre-existing `zolexora_auth_users` table (created earlier by
-- packages/user-auth-zolexora with only id/email/password_hash/email_verified_at/created_at).
-- Run this FIRST, then scripts/db/auth-service-schema.sql. Safe to re-run; keeps existing rows.
-- ==============================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE public.zolexora_auth_users
    ADD COLUMN IF NOT EXISTS zolexora_id       TEXT,
    ADD COLUMN IF NOT EXISTS phone_number      TEXT,
    ADD COLUMN IF NOT EXISTS status            TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

-- Backfill a ZX-XXXX-XXXX-XXXX ID (Crockford alphabet without 0/1) for existing users.
UPDATE public.zolexora_auth_users u
SET zolexora_id = 'ZX-' || array_to_string(ARRAY(
        SELECT CASE WHEN g IN (5, 10) THEN '-'
                    ELSE substr('23456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + floor(random() * 30)::int, 1) END
        FROM generate_series(1, 14) AS g WHERE u.id IS NOT NULL), '')
WHERE zolexora_id IS NULL;

ALTER TABLE public.zolexora_auth_users ALTER COLUMN zolexora_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_auth_users_zolexora_id') THEN
    ALTER TABLE public.zolexora_auth_users ADD CONSTRAINT uq_auth_users_zolexora_id UNIQUE (zolexora_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_auth_users_phone_number') THEN
    ALTER TABLE public.zolexora_auth_users ADD CONSTRAINT uq_auth_users_phone_number UNIQUE (phone_number);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_auth_users_status') THEN
    ALTER TABLE public.zolexora_auth_users ADD CONSTRAINT chk_auth_users_status
      CHECK (status IN ('active', 'suspended', 'deactivated', 'pending'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_auth_users_zx_id_format') THEN
    ALTER TABLE public.zolexora_auth_users ADD CONSTRAINT chk_auth_users_zx_id_format
      CHECK (zolexora_id ~* '^ZX-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$');
  END IF;
END $$;

COMMIT;
