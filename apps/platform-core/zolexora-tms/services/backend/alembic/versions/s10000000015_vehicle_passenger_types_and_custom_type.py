"""Add public/passenger vehicle_body_type enum values and custom_vehicle_type column.

Revision ID: s10000000015
Revises: r10000000014
Create Date: 2026-11-28
"""
from alembic import op
import sqlalchemy as sa

revision = "s10000000015"
down_revision = "r10000000014"
branch_labels = None
depends_on = None

NEW_VEHICLE_TYPES = (
    "SEDAN",
    "HATCHBACK",
    "SUV",
    "TEMPO_TRAVELLER",
    "MINI_BUS",
    "BUS",
    "AUTO_RICKSHAW",
    "EV_CAB",
)


def upgrade() -> None:
    with op.get_context().autocommit_block():
        for val in NEW_VEHICLE_TYPES:
            op.execute(f"ALTER TYPE vehicle_body_type ADD VALUE IF NOT EXISTS '{val}'")

    op.add_column("vehicles", sa.Column("custom_vehicle_type", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("vehicles", "custom_vehicle_type")
