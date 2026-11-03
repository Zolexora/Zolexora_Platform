"""Drop the local role system (role, permission, user_role, role_permission).

Access now follows only from how the person signed in with the Zolexora auth service:
Track 3 platform admins administer, seller organisation membership (Track 1 owners and
members, Track 2 linked staff) sells, everyone else shops.
"""

from alembic import op

revision = "0019_drop_local_roles"
down_revision = "0018_seller_org_zolexora_link"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("role_permission", "user_role", "permission", "role"):
        op.execute(f"DROP TABLE IF EXISTS public.{table}")


def downgrade() -> None:
    op.execute("""
        CREATE TABLE public.role (
            id UUID PRIMARY KEY, role_key VARCHAR(32) NOT NULL, display_name VARCHAR(64) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_role_key UNIQUE (role_key),
            CONSTRAINT ck_role_role_key_values CHECK (role_key IN ('buyer','seller','admin')))""")
    op.execute("""
        CREATE TABLE public.permission (
            id UUID PRIMARY KEY, permission_key VARCHAR(64) NOT NULL, description VARCHAR(200) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_permission_key UNIQUE (permission_key))""")
    op.execute("""
        CREATE TABLE public.role_permission (
            id UUID PRIMARY KEY,
            role_id UUID NOT NULL REFERENCES public.role(id) ON DELETE CASCADE,
            permission_id UUID NOT NULL REFERENCES public.permission(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_role_permission_assignment UNIQUE (role_id, permission_id))""")
    op.execute("CREATE INDEX ix_role_permission_permission_role ON public.role_permission (permission_id, role_id)")
    op.execute("""
        CREATE TABLE public.user_role (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            role_id UUID NOT NULL REFERENCES public.role(id) ON DELETE RESTRICT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_user_role_user UNIQUE (user_id),
            CONSTRAINT uq_user_role_assignment UNIQUE (user_id, role_id))""")
    op.execute("CREATE INDEX ix_user_role_role_user ON public.user_role (role_id, user_id)")
    op.execute("""
        INSERT INTO public.role (id, role_key, display_name) VALUES
        ('10000000-0000-4000-4100-000000000001', 'buyer', 'Buyer'),
        ('20000000-0000-4000-4100-000000000002', 'seller', 'Seller'),
        ('30000000-0000-4000-4100-000000000003', 'admin', 'Administrator')""")
    op.execute("""
        INSERT INTO public.user_role (id, user_id, role_id)
        SELECT u.id, u.id, CASE WHEN EXISTS (
                   SELECT 1 FROM public.seller_org_member m WHERE m.user_id = u.id AND m.status = 'ACTIVE')
               THEN '20000000-0000-4000-4100-000000000002'::uuid
               ELSE '10000000-0000-4000-4100-000000000001'::uuid END
        FROM public.users u""")
