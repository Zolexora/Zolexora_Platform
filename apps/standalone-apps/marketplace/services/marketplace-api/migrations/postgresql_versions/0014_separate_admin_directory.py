"""Fully separate administrators from marketplace users."""

from alembic import op

revision = "0014_separate_admin_directory"
down_revision = "0013_advanced_firebase_user_management"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The canonical operator keeps full permissions; only super-admins may
    # create or change administrator records through the API.
    op.execute("""UPDATE public.admins SET role='super_admin'::admin_role,
        permissions='[\"*\"]'::jsonb WHERE lower(email)='marketplace.admin@zolexora.com'""")
    op.execute("""UPDATE public.admins SET user_id=NULL WHERE lower(email) IN
        (SELECT lower(email) FROM public.admins)""")

    # Remove admin identities from the buyer/seller users and role tables.
    op.execute("""DELETE FROM public.external_identity WHERE user_id IN
        (SELECT u.id FROM public.users u JOIN public.user_role ur ON ur.user_id=u.id
         JOIN public.role r ON r.id=ur.role_id WHERE r.role_key='admin')""")
    op.execute("""DELETE FROM public.user_role WHERE user_id IN
        (SELECT u.id FROM public.users u JOIN public.role r ON r.role_key='admin'
         JOIN public.user_role ur ON ur.role_id=r.id AND ur.user_id=u.id)""")
    op.execute("""DELETE FROM public.user_profile WHERE user_id IN
        (SELECT u.id FROM public.users u WHERE lower(u.email) IN
            (SELECT lower(email) FROM public.admins))""")
    op.execute("""DELETE FROM public.users WHERE lower(email) IN
        (SELECT lower(email) FROM public.admins)""")

    op.execute("ALTER TABLE public.admins DROP CONSTRAINT IF EXISTS admins_user_id_key")
    op.execute("ALTER TABLE public.admins DROP CONSTRAINT IF EXISTS admins_user_id_fkey")
    op.execute("ALTER TABLE public.admins DROP COLUMN IF EXISTS user_id")
    op.execute("ALTER TABLE public.admins DROP COLUMN IF EXISTS firebase_uid")


def downgrade() -> None:
    raise RuntimeError("Forward-only migrations do not support downgrade")
