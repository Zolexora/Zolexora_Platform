"""add eway_bill fields to bookings

Adds eway_bill_number and eway_bill_valid_until to bookings table.

Revision ID: l10000000008
Revises: k10000000007
Create Date: 2026-11-27 20:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op


revision: str = "l10000000008"
down_revision: Union[str, Sequence[str], None] = "k10000000007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("bookings", sa.Column("eway_bill_number", sa.String(32), nullable=True))
    op.add_column("bookings", sa.Column("eway_bill_valid_until", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_bookings_eway_bill_valid_until", "bookings", ["eway_bill_valid_until"])


def downgrade() -> None:
    op.drop_index("ix_bookings_eway_bill_valid_until", table_name="bookings")
    op.drop_column("bookings", "eway_bill_valid_until")
    op.drop_column("bookings", "eway_bill_number")
