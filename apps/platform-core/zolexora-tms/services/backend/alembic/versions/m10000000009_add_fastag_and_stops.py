"""add fastag_transactions table and bookings.stops JSONB

Revision ID: m10000000009
Revises: l10000000008
Create Date: 2026-11-27 21:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
from alembic import op


revision: str = "m10000000009"
down_revision: Union[str, Sequence[str], None] = "l10000000008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "bookings",
        sa.Column("stops", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
    )

    op.create_table(
        "fastag_transactions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organisation_id",
            UUID(as_uuid=True),
            sa.ForeignKey("organisations.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "vehicle_id",
            UUID(as_uuid=True),
            sa.ForeignKey("vehicles.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "trip_id",
            UUID(as_uuid=True),
            sa.ForeignKey("trips.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("transaction_ref", sa.String(128), nullable=False),
        sa.Column("plaza_name", sa.String(256), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("transacted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duplicate_flag", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("reconciled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("raw_payload", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("organisation_id", "transaction_ref", name="uq_fastag_org_ref"),
    )
    op.create_index("ix_fastag_transactions_organisation_id", "fastag_transactions", ["organisation_id"])
    op.create_index("ix_fastag_transactions_vehicle_id", "fastag_transactions", ["vehicle_id"])
    op.create_index("ix_fastag_transactions_trip_id", "fastag_transactions", ["trip_id"])


def downgrade() -> None:
    op.drop_index("ix_fastag_transactions_trip_id", table_name="fastag_transactions")
    op.drop_index("ix_fastag_transactions_vehicle_id", table_name="fastag_transactions")
    op.drop_index("ix_fastag_transactions_organisation_id", table_name="fastag_transactions")
    op.drop_table("fastag_transactions")
    op.drop_column("bookings", "stops")
