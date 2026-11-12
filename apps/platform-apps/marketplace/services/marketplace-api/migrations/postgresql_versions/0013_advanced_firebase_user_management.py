"""Add Firebase-oriented user lifecycle, provider linkage, and admin RBAC."""

from alembic import op

revision = "0013_advanced_firebase_user_management"
down_revision = "0012_allow_multiple_firebase_identities"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Execute statements separately: asyncpg prepared statements reject batches.
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    op.execute("DO $$ BEGIN CREATE TYPE user_status AS ENUM ('active','suspended','banned','pending_verification'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;")
    op.execute("DO $$ BEGIN CREATE TYPE admin_role AS ENUM ('super_admin','support_admin','moderator','compliance_auditor'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;")
    op.execute("DO $$ BEGIN CREATE TYPE auth_provider_type AS ENUM ('google','phone','email_password'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;")
    op.execute("""ALTER TABLE public.users ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(128), ADD COLUMN IF NOT EXISTS phone_number VARCHAR(32), ADD COLUMN IF NOT EXISTS full_name VARCHAR(150) NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS status user_status NOT NULL DEFAULT 'active', ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN IF NOT EXISTS primary_provider auth_provider_type NOT NULL DEFAULT 'email_password', ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb""")
    op.execute("""UPDATE public.users u SET full_name=COALESCE(NULLIF(p.name,''),'Marketplace user') FROM public.user_profile p WHERE p.user_id=u.id AND (u.full_name IS NULL OR u.full_name='')""")
    op.execute("""UPDATE public.users u SET firebase_uid=ei.subject FROM public.external_identity ei WHERE ei.user_id=u.id AND ei.provider='firebase' AND u.firebase_uid IS NULL""")
    op.execute("""UPDATE public.users u SET phone_number=ba.phone,is_phone_verified=TRUE FROM public.buyer_address ba WHERE ba.buyer_id=u.id AND ba.is_default=TRUE AND u.phone_number IS NULL""")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_firebase_uid ON public.users(firebase_uid) WHERE firebase_uid IS NOT NULL")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_phone_number ON public.users(phone_number) WHERE phone_number IS NOT NULL")
    op.execute("CREATE INDEX IF NOT EXISTS idx_users_management_status ON public.users(status)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_users_management_last_login ON public.users(last_login_at DESC)")
    op.execute("""CREATE TABLE IF NOT EXISTS public.user_auth_providers (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, provider_type auth_provider_type NOT NULL, provider_uid VARCHAR(255) NOT NULL, provider_email VARCHAR(255), linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_used_at TIMESTAMPTZ, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, UNIQUE(user_id,provider_type), UNIQUE(provider_type,provider_uid))""")
    op.execute("CREATE INDEX IF NOT EXISTS idx_user_auth_providers_user ON public.user_auth_providers(user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_user_auth_providers_type ON public.user_auth_providers(provider_type)")
    op.execute("""INSERT INTO public.user_auth_providers(user_id,provider_type,provider_uid,provider_email,linked_at) SELECT ei.user_id,'email_password'::auth_provider_type,ei.subject,u.email,COALESCE(ei.created_at,NOW()) FROM public.external_identity ei JOIN public.users u ON u.id=ei.user_id WHERE ei.provider='firebase' ON CONFLICT (provider_type,provider_uid) DO NOTHING""")
    op.execute("""CREATE TABLE IF NOT EXISTS public.admins (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID UNIQUE REFERENCES public.users(id) ON DELETE CASCADE, firebase_uid VARCHAR(128) UNIQUE, email VARCHAR(255) UNIQUE NOT NULL, full_name VARCHAR(150) NOT NULL, role admin_role NOT NULL DEFAULT 'support_admin', permissions JSONB NOT NULL DEFAULT '[]'::jsonb, is_active BOOLEAN NOT NULL DEFAULT TRUE, last_active_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CONSTRAINT admins_permissions_array CHECK (jsonb_typeof(permissions)='array'))""")
    op.execute("CREATE INDEX IF NOT EXISTS idx_admins_firebase_uid ON public.admins(firebase_uid)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_admins_email ON public.admins(email)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_admins_role_active ON public.admins(role,is_active)")
    op.execute("""INSERT INTO public.admins(user_id,firebase_uid,email,full_name,role,permissions,is_active) SELECT u.id,u.firebase_uid,u.email,COALESCE(NULLIF(u.full_name,''),u.email),'super_admin'::admin_role,'["users:read","users:write","rbac:read","rbac:write","audit:read"]'::jsonb,u.is_active FROM public.users u JOIN public.user_role ur ON ur.user_id=u.id JOIN public.role r ON r.id=ur.role_id AND r.role_key='admin' ON CONFLICT(email) DO UPDATE SET user_id=EXCLUDED.user_id,firebase_uid=COALESCE(EXCLUDED.firebase_uid,public.admins.firebase_uid),full_name=EXCLUDED.full_name,is_active=EXCLUDED.is_active,updated_at=NOW()""")
    op.execute("""CREATE TABLE IF NOT EXISTS public.admin_audit_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), admin_id UUID REFERENCES public.admins(id) ON DELETE SET NULL, action_type VARCHAR(100) NOT NULL, target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, details JSONB NOT NULL DEFAULT '{}'::jsonb, ip_address VARCHAR(45), request_id VARCHAR(128), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())""")
    op.execute("CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON public.admin_audit_logs(admin_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON public.admin_audit_logs(target_user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_logs(created_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON public.admin_audit_logs(action_type,created_at DESC)")
    op.execute("""CREATE OR REPLACE FUNCTION public.touch_admin_management_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=NOW(); RETURN NEW; END; $$""")
    op.execute("DROP TRIGGER IF EXISTS trg_admins_management_updated_at ON public.admins")
    op.execute("CREATE TRIGGER trg_admins_management_updated_at BEFORE UPDATE ON public.admins FOR EACH ROW EXECUTE FUNCTION public.touch_admin_management_updated_at()")
    op.execute("""CREATE OR REPLACE FUNCTION public.is_active_marketplace_admin(f_uid TEXT) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.admins WHERE firebase_uid=f_uid AND is_active=TRUE); $$""")
    op.execute("ALTER TABLE public.user_auth_providers ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS user_auth_provider_self_read ON public.user_auth_providers")
    op.execute("""CREATE POLICY user_auth_provider_self_read ON public.user_auth_providers FOR SELECT USING (user_id IN (SELECT id FROM public.users WHERE firebase_uid=current_setting('request.jwt.claim.sub',true)))""")
    op.execute("DROP POLICY IF EXISTS admins_active_admin_read ON public.admins")
    op.execute("""CREATE POLICY admins_active_admin_read ON public.admins FOR SELECT USING (public.is_active_marketplace_admin(current_setting('request.jwt.claim.sub',true)))""")
    op.execute("DROP POLICY IF EXISTS admin_audit_active_admin_read ON public.admin_audit_logs")
    op.execute("""CREATE POLICY admin_audit_active_admin_read ON public.admin_audit_logs FOR SELECT USING (public.is_active_marketplace_admin(current_setting('request.jwt.claim.sub',true)))""")


def downgrade() -> None:
    raise RuntimeError("Forward-only migrations do not support downgrade")
