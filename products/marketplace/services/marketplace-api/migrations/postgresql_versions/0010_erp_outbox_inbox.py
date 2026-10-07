"""Create erp_outbox and erp_inbox tables

Revision ID: 0010_erp_outbox_inbox
Revises: 0009_orders_fulfillment_returns
"""
from alembic import op
import sqlalchemy as sa

revision = "0010_erp_outbox_inbox"
down_revision = "0009_orders_fulfillment_returns"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'erp_inbox',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('external_event_id', sa.String(length=128), nullable=False),
        sa.Column('event_type', sa.String(length=128), nullable=False),
        sa.Column('schema_version', sa.String(length=16), nullable=False),
        sa.Column('payload_hash', sa.String(length=64), nullable=False),
        sa.Column('processing_status', sa.String(length=24), nullable=False),
        sa.Column('correlation_id', sa.String(length=64), nullable=True),
        sa.Column('failure_category', sa.String(length=64), nullable=True),
        sa.Column('received_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id', name='pk_erp_inbox'),
        sa.UniqueConstraint('external_event_id', name='uq_erp_inbox_event')
    )

    op.create_table(
        'erp_outbox',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('event_type', sa.String(length=128), nullable=False),
        sa.Column('schema_version', sa.String(length=16), nullable=False),
        sa.Column('aggregate_type', sa.String(length=64), nullable=False),
        sa.Column('aggregate_id', sa.String(length=128), nullable=False),
        sa.Column('storefront_id', sa.Uuid(), nullable=True),
        sa.Column('correlation_id', sa.String(length=64), nullable=True),
        sa.Column('causation_id', sa.String(length=64), nullable=True),
        sa.Column('idempotency_key', sa.String(length=128), nullable=False),
        sa.Column('payload_json', sa.JSON(), nullable=False),
        sa.Column('payload_hash', sa.String(length=64), nullable=False),
        sa.Column('status', sa.String(length=24), nullable=False),
        sa.Column('attempt_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('available_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('next_attempt_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('lease_owner', sa.String(length=128), nullable=True),
        sa.Column('lease_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['storefront_id'], ['storefront.id'], name='fk_erp_outbox_storefront_id', ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id', name='pk_erp_outbox'),
        sa.UniqueConstraint('idempotency_key', name='uq_erp_outbox_idempotency_key')
    )
    
    op.create_index('ix_erp_outbox_claim', 'erp_outbox', ['status', 'available_at', 'next_attempt_at'])
    
    for table in ('erp_outbox',):
        op.execute(
            f'CREATE TRIGGER trg_{table}_updated_at '
            f'BEFORE UPDATE ON {table} FOR EACH ROW EXECUTE FUNCTION set_updated_at()'
        )

def downgrade() -> None:
    raise RuntimeError("Forward-only migrations do not support downgrade")
