"""Remove legacy credential/provider metadata and lock down the public schema."""

from alembic import op

revision = "0015_remove_legacy_credentials_and_enable_rls"
down_revision = "0014_separate_admin_directory"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Firebase is the sole credential authority. These columns must not remain
    # as a second password or provider identity store in PostgreSQL.
    op.execute("ALTER TABLE public.user_profile DROP CONSTRAINT IF EXISTS user_profile_source_values")
    op.execute("ALTER TABLE public.user_profile DROP CONSTRAINT IF EXISTS ck_user_profile_user_profile_source_values")
    op.execute("ALTER TABLE public.user_profile DROP COLUMN IF EXISTS identity_source")
    op.execute("ALTER TABLE public.users DROP COLUMN IF EXISTS password_hash")

    # Admins are identified by their verified Firebase email; no UID bridge or
    # users-table row is required for the separate admin directory.
    op.execute("DROP POLICY IF EXISTS admins_active_admin_read ON public.admins")
    op.execute("DROP POLICY IF EXISTS admin_audit_active_admin_read ON public.admin_audit_logs")
    op.execute("DROP FUNCTION IF EXISTS public.is_active_marketplace_admin(TEXT)")
    op.execute("""CREATE OR REPLACE FUNCTION public.is_active_marketplace_admin(f_email TEXT)
        RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
        SELECT EXISTS (SELECT 1 FROM public.admins WHERE lower(email)=lower(f_email) AND is_active=TRUE)
        $$""")

    # Enable RLS on every current public base table. Tables without an explicit
    # policy remain deny-by-default for direct Supabase clients.
    op.execute("""DO $$ DECLARE t record; BEGIN
        FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
        END LOOP;
    END $$""")

    # Explicit least-privilege policies for the identity metadata tables.
    for statement in (
        "DROP POLICY IF EXISTS users_self_read ON public.users",
        "DROP POLICY IF EXISTS users_self_update ON public.users",
        "DROP POLICY IF EXISTS users_admin_all ON public.users",
        "CREATE POLICY users_self_read ON public.users FOR SELECT USING (firebase_uid=current_setting('request.jwt.claim.sub',true))",
        "CREATE POLICY users_self_update ON public.users FOR UPDATE USING (firebase_uid=current_setting('request.jwt.claim.sub',true))",
        "CREATE POLICY users_admin_all ON public.users FOR ALL USING (public.is_active_marketplace_admin(current_setting('request.jwt.claim.email',true)))",
        "DROP POLICY IF EXISTS admins_active_admin_read ON public.admins",
        "CREATE POLICY admins_active_admin_read ON public.admins FOR SELECT USING (public.is_active_marketplace_admin(current_setting('request.jwt.claim.email',true)))",
        "DROP POLICY IF EXISTS admin_audit_active_admin_read ON public.admin_audit_logs",
        "CREATE POLICY admin_audit_active_admin_read ON public.admin_audit_logs FOR SELECT USING (public.is_active_marketplace_admin(current_setting('request.jwt.claim.email',true)))",
        "DROP POLICY IF EXISTS user_auth_provider_self_read ON public.user_auth_providers",
        "CREATE POLICY user_auth_provider_self_read ON public.user_auth_providers FOR SELECT USING (user_id IN (SELECT id FROM public.users WHERE firebase_uid=current_setting('request.jwt.claim.sub',true)))",
    ):
        op.execute(statement)


def downgrade() -> None:
    raise RuntimeError("Forward-only migrations do not support downgrade")
