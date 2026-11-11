"""One commerce model: sellers are seller organisations, catalog is master_product/storefront_listing.

Orders, order lines and shipments now point at seller_organization, storefront_listing,
master_product and product_variant. The old person-based catalog and cart (product, listing,
inventory_balance, cart, cart_item) are dropped; stock is inventory_ledger, carts are
shopping_cart (now with the old cart's storefront-immutability trigger, as is
storefront_listing). Refuses to run if any affected table holds rows (live commerce is still in
MongoDB), so nothing is silently discarded.
"""

from alembic import context, op
from sqlalchemy import text

revision = "0020_unify_commerce_on_organisations"
down_revision = "0019_drop_local_roles"
branch_labels = None
depends_on = None

_CHECKED = ("product", "listing", "inventory_balance", "cart", "cart_item", "marketplace_order", "order_item", "shipment")
_DROPPED = ("cart_item", "cart", "inventory_balance", "listing", "product")


def upgrade() -> None:
    if not context.is_offline_mode():  # offline (--sql) has no rows to check
        bind = op.get_bind()
        used = {t: bind.execute(text(f"SELECT count(*) FROM public.{t}")).scalar() for t in _CHECKED}
        used = {t: n for t, n in used.items() if n}
        if used:
            raise RuntimeError(f"Move these rows to the organisation model before upgrading: {used}")

    # Orders belong to a seller organisation.
    op.execute("ALTER TABLE public.marketplace_order DROP CONSTRAINT fk_marketplace_order_seller_id")
    op.execute("ALTER TABLE public.marketplace_order RENAME COLUMN seller_id TO organization_id")
    op.execute("""ALTER TABLE public.marketplace_order ADD CONSTRAINT fk_marketplace_order_organization_id
                  FOREIGN KEY (organization_id) REFERENCES public.seller_organization(id) ON DELETE RESTRICT""")
    op.execute("ALTER INDEX public.ix_order_storefront_seller_created RENAME TO ix_order_storefront_org_created")

    # Order lines point at the listing (same storefront and organisation) and the variant sold.
    op.execute("""ALTER TABLE public.storefront_listing ADD CONSTRAINT uq_storefront_listing_scope
                  UNIQUE (id, storefront_id, organization_id)""")
    op.execute("ALTER TABLE public.order_item DROP CONSTRAINT fk_order_item_listing_scope")
    op.execute("ALTER TABLE public.order_item RENAME COLUMN listing_id TO storefront_listing_id")
    op.execute("ALTER TABLE public.order_item RENAME COLUMN seller_id TO organization_id")
    op.execute("ALTER TABLE public.order_item ADD COLUMN variant_id UUID NOT NULL")
    op.execute("""ALTER TABLE public.order_item ADD CONSTRAINT fk_order_item_listing_scope
                  FOREIGN KEY (storefront_listing_id, storefront_id, organization_id)
                  REFERENCES public.storefront_listing(id, storefront_id, organization_id) ON DELETE RESTRICT""")
    op.execute("""ALTER TABLE public.order_item ADD CONSTRAINT fk_order_item_product_id
                  FOREIGN KEY (product_id) REFERENCES public.master_product(id) ON DELETE RESTRICT""")
    op.execute("""ALTER TABLE public.order_item ADD CONSTRAINT fk_order_item_variant_id
                  FOREIGN KEY (variant_id) REFERENCES public.product_variant(id) ON DELETE RESTRICT""")
    op.execute("CREATE INDEX ix_order_item_org_order ON public.order_item (organization_id, order_id)")

    # Shipments are sent by the seller organisation.
    op.execute("ALTER TABLE public.shipment DROP CONSTRAINT fk_shipment_seller_id")
    op.execute("ALTER TABLE public.shipment RENAME COLUMN seller_id TO organization_id")
    op.execute("""ALTER TABLE public.shipment ADD CONSTRAINT fk_shipment_organization_id
                  FOREIGN KEY (organization_id) REFERENCES public.seller_organization(id) ON DELETE RESTRICT""")
    op.execute("ALTER INDEX public.ix_shipment_storefront_seller_order RENAME TO ix_shipment_storefront_org_order")

    for table in _DROPPED:
        op.execute(f"DROP TABLE public.{table}")
    op.execute("DROP FUNCTION IF EXISTS public.reject_cart_storefront_id_change()")

    # Carts and listings stay on their storefront, as the old cart did.
    op.execute("""
        CREATE FUNCTION public.reject_storefront_id_change() RETURNS trigger AS $$
        BEGIN
            IF OLD.storefront_id IS DISTINCT FROM NEW.storefront_id THEN
                RAISE EXCEPTION '%.storefront_id is immutable (row %)', TG_TABLE_NAME, OLD.id USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql""")
    for table in ("shopping_cart", "storefront_listing"):
        op.execute(f"""CREATE TRIGGER trg_{table}_storefront_id_immutable BEFORE UPDATE ON public.{table}
                       FOR EACH ROW EXECUTE FUNCTION public.reject_storefront_id_change()""")


def downgrade() -> None:
    raise RuntimeError("Forward-only migrations do not support downgrade")
