"""Add supervisor_id, supervisor_name, supervisor_phone to duties.

Revision ID: w10000000019
Revises: v10000000018
Create Date: 2026-11-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "w10000000019"
down_revision = "v10000000018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("SET LOCAL app.bypass_rls = 'on'")
    op.add_column("duties", sa.Column("supervisor_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("duties", sa.Column("supervisor_name", sa.String(length=160), nullable=True))
    op.add_column("duties", sa.Column("supervisor_phone", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("duties", "supervisor_phone")
    op.drop_column("duties", "supervisor_name")
    op.drop_column("duties", "supervisor_id")
