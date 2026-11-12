"""Sign-in moves to the Zolexora auth service.

- users.auth_user_id links a marketplace profile to its auth-service account. New
  profiles use the auth-service id as users.id; older profiles are linked on first
  sign-in by their (auth-service verified) email.
- Firebase identity bridges, local admin directory and session versioning are removed:
  administrators are auth-service platform admins, sessions are auth-service tokens.
- Phone numbers copied from delivery addresses by 0013 were never verified; the auth
  service is now the phone authority and fills them on the next sign-in.
"""

from alembic import op

revision = "0017_zolexora_auth_service"
down_revision = "0016_remove_provider_classification"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id UUID")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_auth_user_id ON public.users(auth_user_id)")
    op.execute("UPDATE public.users SET phone_number = NULL, is_phone_verified = FALSE")

    # Policies that read Firebase claims or the local admin directory.
    for policy, table in (
        ("users_self_read", "users"),
        ("users_self_update", "users"),
        ("users_admin_all", "users"),
        ("admin_audit_active_admin_read", "admin_audit_logs"),
    ):
        op.execute(f"DROP POLICY IF EXISTS {policy} ON public.{table}")

    # Audit rows keep the auth-service admin id; there is no local admins table to reference.
    op.execute("ALTER TABLE public.admin_audit_logs DROP CONSTRAINT IF EXISTS admin_audit_logs_admin_id_fkey")
    op.execute("ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS admin_email VARCHAR(255)")
    op.execute("""UPDATE public.admin_audit_logs l SET admin_email = a.email
                  FROM public.admins a WHERE a.id = l.admin_id AND l.admin_email IS NULL""")

    op.execute("DROP TABLE IF EXISTS public.admins")
    op.execute("DROP TYPE IF EXISTS public.admin_role")
    op.execute("DROP TABLE IF EXISTS public.user_auth_providers")
    op.execute("DROP TABLE IF EXISTS public.external_identity")
    op.execute("DROP FUNCTION IF EXISTS public.is_active_marketplace_admin(TEXT)")
    op.execute("DROP INDEX IF EXISTS public.uq_users_firebase_uid")
    op.execute("ALTER TABLE public.users DROP COLUMN IF EXISTS firebase_uid")
    op.execute("ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_auth_version_positive")
    op.execute("ALTER TABLE public.users DROP CONSTRAINT IF EXISTS ck_users_users_auth_version_positive")
    op.execute("ALTER TABLE public.users DROP COLUMN IF EXISTS auth_version")
    op.execute("ALTER TABLE public.users DROP COLUMN IF EXISTS last_authenticated_at")


def downgrade() -> None:
    raise RuntimeError("Forward-only migrations do not support downgrade")
