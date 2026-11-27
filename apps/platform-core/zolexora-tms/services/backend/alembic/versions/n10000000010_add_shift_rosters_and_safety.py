"""add shift_rosters table and booking safety/PIN fields

Revision ID: n10000000010
Revises: m10000000009
Create Date: 2026-11-27 22:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
from alembic import op


revision: str = "n10000000010"
down_revision: Union[str, Sequence[str], None] = "m10000000009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("bookings", sa.Column("boarding_pin", sa.String(8), nullable=True))
    op.add_column(
        "bookings",
        sa.Column("escort_required", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column("bookings", sa.Column("escort_guard_name", sa.String(128), nullable=True))
    op.add_column("bookings", sa.Column("safe_drop_confirmed_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "shift_rosters",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organisation_id",
            UUID(as_uuid=True),
            sa.ForeignKey("organisations.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "customer_id",
            UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("route_code", sa.String(64), nullable=False),
        sa.Column("route_name", sa.String(128), nullable=False),
        sa.Column("booking_type", sa.String(32), nullable=False, server_default="ETS"),
        sa.Column("shift_label", sa.String(64), nullable=False),
        sa.Column("shift_time", sa.String(16), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="120"),
        sa.Column("weekdays", JSONB, nullable=False, server_default=sa.text("'[0,1,2,3,4]'::jsonb")),
        sa.Column("pickup_address", sa.Text(), nullable=False),
        sa.Column("pickup_lat", sa.Float(), nullable=True),
        sa.Column("pickup_lng", sa.Float(), nullable=True),
        sa.Column("drop_address", sa.Text(), nullable=False),
        sa.Column("drop_lat", sa.Float(), nullable=True),
        sa.Column("drop_lng", sa.Float(), nullable=True),
        sa.Column(
            "default_driver_id",
            UUID(as_uuid=True),
            sa.ForeignKey("drivers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "default_vehicle_id",
            UUID(as_uuid=True),
            sa.ForeignKey("vehicles.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("stops", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("escort_required", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("organisation_id", "route_code", name="uq_shift_roster_org_code"),
    )
    op.create_index("ix_shift_rosters_organisation_id", "shift_rosters", ["organisation_id"])


def downgrade() -> None:
    op.drop_index("ix_shift_rosters_organisation_id", table_name="shift_rosters")
    op.drop_table("shift_rosters")
    op.drop_column("bookings", "safe_drop_confirmed_at")
    op.drop_column("bookings", "escort_guard_name")
    op.drop_column("bookings", "escort_required")
    op.drop_column("bookings", "boarding_pin")
