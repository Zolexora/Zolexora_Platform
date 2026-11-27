"""add device_tokens table

Stores Expo push tokens for real-time duty assignment alerts on mobile.

Revision ID: j10000000006
Revises: i10000000005
Create Date: 2026-11-27 18:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID


revision: str = "j10000000006"
down_revision: Union[str, Sequence[str], None] = "i10000000005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "device_tokens",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("platform", sa.String(16), nullable=False),
        sa.Column("token", sa.String(256), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("user_id", "platform", name="uq_device_tokens_user_platform"),
    )
    op.create_index("ix_device_tokens_user_id", "device_tokens", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_device_tokens_user_id", table_name="device_tokens")
    op.drop_table("device_tokens")
