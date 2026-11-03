"""Seller organisations can be linked to a Zolexora (auth-service) organisation.

Staff of a seller sign in with the auth service's Track 2 employee login (ZX-ORG id). A
platform admin links that ZX-ORG id to the seller organisation, like TMS workspaces.
"""

from alembic import op

revision = "0018_seller_org_zolexora_link"
down_revision = "0017_zolexora_auth_service"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE public.seller_organization ADD COLUMN IF NOT EXISTS zolexora_org_id VARCHAR(64)")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_seller_organization_zolexora_org_id "
        "ON public.seller_organization(zolexora_org_id) WHERE zolexora_org_id IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS public.uq_seller_organization_zolexora_org_id")
    op.execute("ALTER TABLE public.seller_organization DROP COLUMN IF EXISTS zolexora_org_id")
