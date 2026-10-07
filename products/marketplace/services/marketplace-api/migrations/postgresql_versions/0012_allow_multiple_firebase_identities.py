"""Allow multiple Firebase provider identities per Marketplace user."""

from alembic import op


revision = "0012_allow_multiple_firebase_identities"
down_revision = "0011_firebase_external_identity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("uq_external_identity_provider_user", "external_identity", type_="unique")


def downgrade() -> None:
    raise RuntimeError("Forward-only migrations do not support downgrade")
