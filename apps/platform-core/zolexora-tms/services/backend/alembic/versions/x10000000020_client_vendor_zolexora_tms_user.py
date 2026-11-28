"""Add is_zolexora_user and zolexora_org_id to clients and vendors.

Revision ID: x10000000020
Revises: w10000000019
Create Date: 2026-11-28
"""
from alembic import op
import sqlalchemy as sa

revision = "x10000000020"
down_revision = "w10000000019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("SET LOCAL app.bypass_rls = 'on'")
    for table in ("clients", "vendors"):
        op.add_column(
            table,
            sa.Column("is_zolexora_user", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        )
        op.add_column(
            table,
            sa.Column("zolexora_org_id", sa.String(length=64), nullable=True),
        )


def downgrade() -> None:
    for table in ("vendors", "clients"):
        op.drop_column(table, "zolexora_org_id")
        op.drop_column(table, "is_zolexora_user")
