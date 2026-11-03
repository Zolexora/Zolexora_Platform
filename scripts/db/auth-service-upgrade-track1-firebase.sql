-- ==============================================================================
-- AUTH DATABASE (AUTH_DATABASE_URL / ZOLEXORA_AUTHENTICATION_DATABASE_URL)
-- Track 1 Firebase sign-in: display name, linked Google (Firebase) UID, E.164 phone numbers.
-- For databases created before these columns existed. Safe to re-run; keeps existing rows.
-- ==============================================================================
BEGIN;

ALTER TABLE public.zolexora_auth_users
    ADD COLUMN IF NOT EXISTS display_name TEXT,
    ADD COLUMN IF NOT EXISTS firebase_uid TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_auth_users_firebase_uid') THEN
    ALTER TABLE public.zolexora_auth_users ADD CONSTRAINT uq_auth_users_firebase_uid UNIQUE (firebase_uid);
  END IF;
  -- NOT VALID: enforced for new/updated rows without failing on any legacy value.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_auth_users_phone_e164') THEN
    ALTER TABLE public.zolexora_auth_users ADD CONSTRAINT chk_auth_users_phone_e164
      CHECK (phone_number IS NULL OR phone_number ~ '^\+[1-9][0-9]{7,14}$') NOT VALID;
  END IF;
END $$;

COMMIT;
