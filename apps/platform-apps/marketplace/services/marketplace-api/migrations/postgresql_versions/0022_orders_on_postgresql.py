"""Orders move from MongoDB to PostgreSQL (commerce step 4).

marketplace_order gains the checkout it belongs to (one checkout = one order per seller
organisation), how it is paid, the buyer's idempotency key and a JSONB details column for the
order's workflow records (cancellations, returns, shipment events, payment references).
"""

from alembic import op

revision = "0022_orders_on_postgresql"
down_revision = "0021_master_product_images"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""ALTER TABLE public.marketplace_order
                  ADD COLUMN checkout_id UUID,
                  ADD COLUMN payment_method VARCHAR(32),
                  ADD COLUMN idempotency_key VARCHAR(128),
                  ADD COLUMN details JSONB NOT NULL DEFAULT '{}'::jsonb""")
    op.execute("""ALTER TABLE public.marketplace_order ADD CONSTRAINT ck_marketplace_order_details_object
                  CHECK (jsonb_typeof(details) = 'object')""")
    op.execute("CREATE INDEX ix_order_checkout ON public.marketplace_order (checkout_id)")
    op.execute("""CREATE INDEX ix_order_buyer_idempotency ON public.marketplace_order (buyer_id, idempotency_key)
                  WHERE idempotency_key IS NOT NULL""")


def downgrade() -> None:
    raise RuntimeError("Forward-only migrations do not support downgrade")
