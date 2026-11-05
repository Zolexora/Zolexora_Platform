"""Shipping moves from MongoDB to PostgreSQL (commerce step 4b).

A courier shipment is a shipment row (one per order): the carrier's progress in courier_status,
the AWB in external_reference, and the courier options, booking attempts and tracking events in
a JSONB details column. Seller pickup addresses are pickup_location rows of the organisation.
"""

from alembic import op

revision = "0023_shipping_on_postgresql"
down_revision = "0022_orders_on_postgresql"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""ALTER TABLE public.shipment
                  ADD COLUMN courier_status VARCHAR(40) NOT NULL DEFAULT 'pending',
                  ADD COLUMN attention_required BOOLEAN NOT NULL DEFAULT false,
                  ADD COLUMN details JSONB NOT NULL DEFAULT '{}'::jsonb""")
    op.execute("""ALTER TABLE public.shipment ADD CONSTRAINT ck_shipment_details_object
                  CHECK (jsonb_typeof(details) = 'object')""")
    op.execute("CREATE UNIQUE INDEX uq_shipment_order ON public.shipment (order_id)")
    op.execute("CREATE INDEX ix_shipment_awb ON public.shipment (external_reference) WHERE external_reference IS NOT NULL")

    op.execute("""CREATE TABLE public.pickup_location (
                  id UUID PRIMARY KEY,
                  organization_id UUID NOT NULL REFERENCES public.seller_organization (id) ON DELETE CASCADE,
                  label VARCHAR(120) NOT NULL, contact_name VARCHAR(200) NOT NULL,
                  phone VARCHAR(32) NOT NULL, email VARCHAR(320) NOT NULL,
                  address_line_1 VARCHAR(300) NOT NULL, address_line_2 VARCHAR(300) NOT NULL DEFAULT '',
                  city VARCHAR(120) NOT NULL, state VARCHAR(120) NOT NULL, pincode VARCHAR(12) NOT NULL,
                  country VARCHAR(80) NOT NULL DEFAULT 'India', gst_number VARCHAR(32) NOT NULL DEFAULT '',
                  is_default BOOLEAN NOT NULL DEFAULT false,
                  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())""")
    op.execute("CREATE INDEX ix_pickup_location_org ON public.pickup_location (organization_id)")
    op.execute("""CREATE UNIQUE INDEX uq_pickup_location_default ON public.pickup_location (organization_id)
                  WHERE is_default""")


def downgrade() -> None:
    raise RuntimeError("Forward-only migrations do not support downgrade")
