-- Run once on the dedicated Zolexora authentication PostgreSQL database.
CREATE TABLE IF NOT EXISTS public.zolexora_auth_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.zolexora_auth_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.zolexora_auth_users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify-email', 'reset-password')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zolexora_auth_tokens_user_idx ON public.zolexora_auth_tokens(user_id);
CREATE INDEX IF NOT EXISTS zolexora_auth_tokens_expiry_idx ON public.zolexora_auth_tokens(expires_at);

CREATE TABLE IF NOT EXISTS public.zolexora_auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.zolexora_auth_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zolexora_auth_sessions_user_idx ON public.zolexora_auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS zolexora_auth_sessions_expiry_idx ON public.zolexora_auth_sessions(expires_at);
