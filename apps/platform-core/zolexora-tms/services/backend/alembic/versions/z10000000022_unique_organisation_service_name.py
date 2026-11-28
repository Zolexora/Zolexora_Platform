"""Add case-insensitive unique index on organisation_services (organisation_id, LOWER(TRIM(name))).

Revision ID: z10000000022
Revises: y10000000021
Create Date: 2026-11-28
"""
from alembic import op

revision = "z10000000022"
down_revision = "y10000000021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("SET LOCAL app.bypass_rls = 'on'")
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_org_services_org_name_ci
        ON organisation_services (organisation_id, LOWER(TRIM(name)))
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_org_services_org_name_ci")
