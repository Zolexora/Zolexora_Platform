"""link TMS organisations to Zolexora auth-service organisations

Employee-track logins carry a ZX-ORG id; a platform admin links it to one TMS workspace.

Revision ID: h10000000004
Revises: g10000000003
Create Date: 2026-11-02 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = 'h10000000004'
down_revision: Union[str, Sequence[str], None] = 'g10000000003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('organisations', sa.Column('zolexora_org_id', sa.String(length=64), nullable=True))
    op.create_unique_constraint('uq_organisations_zolexora_org_id', 'organisations', ['zolexora_org_id'])


def downgrade() -> None:
    op.drop_constraint('uq_organisations_zolexora_org_id', 'organisations', type_='unique')
    op.drop_column('organisations', 'zolexora_org_id')
