"""control plane tables, enum values, vendor notes

Brings the Alembic schema in line with the ORM models:
- platform_admins / tenant_quotas were previously only created by create_all at startup.
- vendors.notes is used by the Vendor model.
- Enum values used by the application but missing from the Postgres enum types.

Every step is idempotent so it is safe on databases where create_all already ran.

Revision ID: f10000000002
Revises: e10000000001
Create Date: 2026-10-30 10:23:55.924931

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f10000000002'
down_revision: Union[str, Sequence[str], None] = 'e10000000001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ENUM_VALUES = {
    "duty_lifecycle_status": ["UNASSIGNED", "ASSIGNED", "DRIVER_ACCEPTANCE_PENDING", "ACCEPTED"],
    "duty_assignment_status": ["PENDING", "CANCELLED"],
    "rate_rule_type": ["FIXED_MONTHLY", "SLAB_KM"],
}


def upgrade() -> None:
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())

    if "platform_admins" not in tables:
        op.create_table(
            'platform_admins',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('user_id', sa.UUID(), nullable=False),
            sa.Column('email', sa.String(length=255), nullable=True),
            sa.Column('status', sa.String(length=20), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.PrimaryKeyConstraint('id', name=op.f('pk_platform_admins')),
        )
        op.create_index(op.f('ix_platform_admins_user_id'), 'platform_admins', ['user_id'], unique=True)

    if "tenant_quotas" not in tables:
        op.create_table(
            'tenant_quotas',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('organisation_id', sa.UUID(), nullable=False),
            sa.Column('tier', sa.String(length=50), nullable=False),
            sa.Column('max_members', sa.Integer(), nullable=False),
            sa.Column('max_vehicles', sa.Integer(), nullable=False),
            sa.Column('max_duties_per_month', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.ForeignKeyConstraint(['organisation_id'], ['organisations.id'], name=op.f('fk_tenant_quotas_organisation_id_organisations'), ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id', name=op.f('pk_tenant_quotas')),
        )
        op.create_index(op.f('ix_tenant_quotas_organisation_id'), 'tenant_quotas', ['organisation_id'], unique=True)

    op.execute("ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS notes VARCHAR")

    # ALTER TYPE ... ADD VALUE must run outside a transaction block
    with op.get_context().autocommit_block():
        for enum_name, values in ENUM_VALUES.items():
            for value in values:
                op.execute(f"ALTER TYPE public.{enum_name} ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    # Postgres cannot drop enum values; only the additive table/column changes are reverted.
    op.execute("ALTER TABLE public.vendors DROP COLUMN IF EXISTS notes")
    op.execute("DROP TABLE IF EXISTS public.tenant_quotas")
    op.execute("DROP TABLE IF EXISTS public.platform_admins")
