"""Provider choice is not authorization; remove provider classification fields."""

from alembic import op

revision = "0016_remove_provider_classification"
down_revision = "0015_remove_legacy_credentials_and_enable_rls"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE public.users DROP COLUMN IF EXISTS primary_provider")
    op.execute("ALTER TABLE public.user_auth_providers DROP COLUMN IF EXISTS provider_type CASCADE")
    # A Firebase UID is the one identity bridge regardless of which sign-in
    # method was used. Keep one provider record per marketplace user/UID.
    op.execute("""DELETE FROM public.user_auth_providers a USING public.user_auth_providers b
        WHERE a.user_id=b.user_id AND a.id < b.id""")
    op.execute("DROP INDEX IF EXISTS public.idx_user_auth_providers_type")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_user_auth_providers_user ON public.user_auth_providers(user_id)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_user_auth_providers_uid ON public.user_auth_providers(provider_uid)")
    op.execute("DROP TYPE IF EXISTS public.auth_provider_type")


def downgrade() -> None:
    raise RuntimeError("Forward-only migrations do not support downgrade")
