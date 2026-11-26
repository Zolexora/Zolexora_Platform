"""add workspace_type to organisations

Distinguishes Service Provider workspaces from Client portal workspaces.

Revision ID: i10000000005
Revises: h10000000004
Create Date: 2026-11-27 00:25:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = 'i10000000005'
down_revision: Union[str, Sequence[str], None] = 'h10000000004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    workspace_type_enum = sa.Enum('SERVICE_PROVIDER', 'CLIENT', name='workspace_type')
    workspace_type_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        'organisations',
        sa.Column(
            'workspace_type',
            workspace_type_enum,
            server_default='SERVICE_PROVIDER',
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column('organisations', 'workspace_type')
    sa.Enum('SERVICE_PROVIDER', 'CLIENT', name='workspace_type').drop(op.get_bind(), checkfirst=True)
