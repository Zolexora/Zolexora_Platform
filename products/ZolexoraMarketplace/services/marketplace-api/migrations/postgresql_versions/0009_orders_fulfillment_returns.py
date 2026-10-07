"""orders fulfillment returns

Revision ID: 0009_orders_fulfillment_returns
Revises: 0008_order_capture_payment_orchestration
"""
from alembic import op
import sqlalchemy as sa

revision = '0009_orders_fulfillment_returns'
down_revision = '0008_order_capture_payment_orchestration'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'order_state_history',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('order_id', sa.Uuid(), nullable=False),
        sa.Column('previous_status', sa.String(length=32), nullable=True),
        sa.Column('new_status', sa.String(length=32), nullable=False),
        sa.Column('reason', sa.String(length=500), nullable=True),
        sa.Column('actor_id', sa.Uuid(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("new_status IN ('draft','placed','payment_pending','paid','processing','partially_fulfilled','fulfilled','completed','cancelled','partially_cancelled','returned','partially_returned')", name='order_state_history_new_status_values'),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id'], name='fk_order_state_history_actor_id', ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['order_id'], ['marketplace_order.id'], name='fk_order_state_history_order_id', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='pk_order_state_history')
    )

    op.create_table(
        'fulfillment_record',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('order_id', sa.Uuid(), nullable=False),
        sa.Column('storefront_id', sa.Uuid(), nullable=False),
        sa.Column('status', sa.String(length=32), server_default='processing', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("status IN ('unfulfilled','allocated','processing','shipped','out_for_delivery','delivered','failed_delivery','returned_to_origin','cancelled')", name='fulfillment_record_status_values'),
        sa.ForeignKeyConstraint(['order_id'], ['marketplace_order.id'], name='fk_fulfillment_record_order_id', ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['storefront_id'], ['storefront.id'], name='fk_fulfillment_record_storefront_id', ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id', name='pk_fulfillment_record')
    )

    op.create_table(
        'shipment_line',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('shipment_id', sa.Uuid(), nullable=False),
        sa.Column('order_item_id', sa.Uuid(), nullable=False),
        sa.Column('quantity', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('quantity BETWEEN 1 AND 9007199254740991', name='shipment_line_quantity_bounds'),
        sa.ForeignKeyConstraint(['order_item_id'], ['order_item.id'], name='fk_shipment_line_order_item_id', ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['shipment_id'], ['shipment.id'], name='fk_shipment_line_shipment_id', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='pk_shipment_line')
    )

    op.create_table(
        'shipment_tracking_event',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('shipment_id', sa.Uuid(), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('location', sa.String(length=200), nullable=True),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("status IN ('unfulfilled','allocated','processing','shipped','out_for_delivery','delivered','failed_delivery','returned_to_origin','cancelled')", name='shipment_tracking_event_status_values'),
        sa.ForeignKeyConstraint(['shipment_id'], ['shipment.id'], name='fk_shipment_tracking_event_shipment_id', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='pk_shipment_tracking_event')
    )

    op.create_table(
        'return_request',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('order_id', sa.Uuid(), nullable=False),
        sa.Column('storefront_id', sa.Uuid(), nullable=False),
        sa.Column('buyer_id', sa.Uuid(), nullable=False),
        sa.Column('status', sa.String(length=32), server_default='pending', nullable=False),
        sa.Column('reason', sa.String(length=500), nullable=True),
        sa.Column('refund_amount_minor', sa.BigInteger(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("refund_amount_minor BETWEEN 0 AND 9007199254740991", name='return_request_refund_amount_bounds'),
        sa.CheckConstraint("status IN ('pending','approved','rejected','completed')", name='return_request_status_values'),
        sa.ForeignKeyConstraint(['buyer_id'], ['users.id'], name='fk_return_request_buyer_id', ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['order_id'], ['marketplace_order.id'], name='fk_return_request_order_id', ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['storefront_id'], ['storefront.id'], name='fk_return_request_storefront_id', ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id', name='pk_return_request')
    )

    op.create_table(
        'return_authorization',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('return_request_id', sa.Uuid(), nullable=False),
        sa.Column('status', sa.String(length=32), server_default='issued', nullable=False),
        sa.Column('rma_number', sa.String(length=64), nullable=False),
        sa.Column('instructions', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("status IN ('issued','received','processed')", name='return_authorization_status_values'),
        sa.ForeignKeyConstraint(['return_request_id'], ['return_request.id'], name='fk_return_authorization_return_request_id', ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id', name='pk_return_authorization'),
        sa.UniqueConstraint('rma_number', name='uq_return_authorization_rma')
    )

    op.create_table(
        'dispute_reason',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('code', sa.String(length=64), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id', name='pk_dispute_reason'),
        sa.UniqueConstraint('code', name='uq_dispute_reason_code')
    )

    op.create_table(
        'dispute',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('order_id', sa.Uuid(), nullable=False),
        sa.Column('storefront_id', sa.Uuid(), nullable=False),
        sa.Column('reason_id', sa.Uuid(), nullable=False),
        sa.Column('status', sa.String(length=32), server_default='opened', nullable=False),
        sa.Column('resolution', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("status IN ('opened','under_review','resolved','closed')", name='dispute_status_values'),
        sa.ForeignKeyConstraint(['order_id'], ['marketplace_order.id'], name='fk_dispute_order_id', ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['reason_id'], ['dispute_reason.id'], name='fk_dispute_reason_id', ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['storefront_id'], ['storefront.id'], name='fk_dispute_storefront_id', ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id', name='pk_dispute')
    )

    for table in ('fulfillment_record', 'return_request', 'return_authorization', 'dispute_reason', 'dispute'):
        op.execute(
            f'CREATE TRIGGER trg_{table}_updated_at '
            f'BEFORE UPDATE ON {table} FOR EACH ROW EXECUTE FUNCTION set_updated_at()'
        )

def downgrade() -> None:
    raise RuntimeError("Forward-only migrations do not support downgrade")
