"""add share_token to trips

Adds share_token and share_token_expires_at columns to the trips table
to enable client-shareable live tracking links without requiring login.

Revision ID: k10000000007
Revises: j10000000006
Create Date: 2026-11-27 19:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op


revision: str = "k10000000007"
down_revision: Union[str, Sequence[str], None] = "j10000000006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("trips", sa.Column("share_token", sa.String(64), nullable=True, unique=True))
    op.add_column("trips", sa.Column("share_token_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_trips_share_token", "trips", ["share_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_trips_share_token", table_name="trips")
    op.drop_column("trips", "share_token_expires_at")
    op.drop_column("trips", "share_token")
