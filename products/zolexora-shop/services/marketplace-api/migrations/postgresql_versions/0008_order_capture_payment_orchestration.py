"""order capture payment orchestration

Revision ID: 0008_order_capture_payment_orchestration
Revises: 0007_cart_wishlist_checkout_quote
"""
from alembic import op
import sqlalchemy as sa

revision = '0008_order_capture_payment_orchestration'
down_revision = '0007_cart_wishlist_checkout_quote'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. payment_webhook_receipt table
    op.create_table(
        'payment_webhook_receipt',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('storefront_id', sa.Uuid(), nullable=False),
        sa.Column('provider', sa.String(length=64), nullable=False),
        sa.Column('external_event_id', sa.String(length=256), nullable=False),
        sa.Column('status', sa.String(length=32), server_default='unprocessed', nullable=False),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.Column('signature', sa.String(length=512), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("status IN ('unprocessed','processed','failed')", name=op.f('payment_webhook_receipt_status_values')),
        sa.ForeignKeyConstraint(['storefront_id'], ['storefront.id'], name=op.f('fk_payment_webhook_receipt_storefront_id'), ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_payment_webhook_receipt')),
        sa.UniqueConstraint('provider', 'external_event_id', name='uq_payment_webhook_receipt_event')
    )

    # 2. payment_transaction_ledger table
    op.create_table(
        'payment_transaction_ledger',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('payment_record_id', sa.Uuid(), nullable=False),
        sa.Column('type', sa.String(length=32), nullable=False),
        sa.Column('amount_minor', sa.BigInteger(), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("type IN ('AUTHORIZATION','CAPTURE','REFUND','VOID','FAILURE')", name=op.f('payment_transaction_ledger_type_values')),
        sa.CheckConstraint("amount_minor BETWEEN 0 AND 9007199254740991", name=op.f('payment_transaction_ledger_amount_bounds')),
        sa.CheckConstraint("currency = upper(currency) AND length(currency) = 3", name=op.f('payment_transaction_ledger_currency_shape')),
        sa.ForeignKeyConstraint(['payment_record_id'], ['payment_record.id'], name=op.f('fk_payment_transaction_ledger_payment_record_id'), ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_payment_transaction_ledger'))
    )

    # 3. Set updated_at trigger for payment_webhook_receipt
    op.execute(
        'CREATE TRIGGER trg_payment_webhook_receipt_updated_at '
        'BEFORE UPDATE ON payment_webhook_receipt FOR EACH ROW EXECUTE FUNCTION set_updated_at()'
    )


def downgrade() -> None:
    raise RuntimeError("Forward-only migrations do not support downgrade")
