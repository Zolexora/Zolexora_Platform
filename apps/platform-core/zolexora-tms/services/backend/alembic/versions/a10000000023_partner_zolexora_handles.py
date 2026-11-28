"""Widen clients.client_code and vendors.vendor_code to VARCHAR(64) for @zolexora.com partner IDs.

Revision ID: a10000000023
Revises: z10000000022
Create Date: 2026-11-28
"""
from alembic import op
import sqlalchemy as sa

revision = "a10000000023"
down_revision = "z10000000022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("SET LOCAL app.bypass_rls = 'on'")
    op.alter_column("clients", "client_code", existing_type=sa.String(length=32), type_=sa.String(length=64), existing_nullable=True)
    op.alter_column("vendors", "vendor_code", existing_type=sa.String(length=32), type_=sa.String(length=64), existing_nullable=True)


def downgrade() -> None:
    op.alter_column("vendors", "vendor_code", existing_type=sa.String(length=64), type_=sa.String(length=32), existing_nullable=True)
    op.alter_column("clients", "client_code", existing_type=sa.String(length=64), type_=sa.String(length=32), existing_nullable=True)
