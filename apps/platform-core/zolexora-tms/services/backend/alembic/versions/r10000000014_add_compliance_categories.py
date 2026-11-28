"""Add additional compliance_category enum values.

Revision ID: r10000000014
Revises: q10000000013
Create Date: 2026-11-28
"""
from alembic import op

revision = "r10000000014"
down_revision = "q10000000013"
branch_labels = None
depends_on = None

NEW_CATEGORIES = (
    "KYC_IDENTITY",
    "TAX_GST",
    "FINANCIAL_BANKING",
    "INSURANCE",
    "PERMIT_LICENSE",
    "OPERATIONAL",
)


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction block in PostgreSQL
    with op.get_context().autocommit_block():
        for val in NEW_CATEGORIES:
            op.execute(f"ALTER TYPE compliance_category ADD VALUE IF NOT EXISTS '{val}'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values safely without recreating the type.
    pass
