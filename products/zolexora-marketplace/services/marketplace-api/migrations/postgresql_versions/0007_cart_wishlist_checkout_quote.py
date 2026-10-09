"""cart wishlist checkout quote

Revision ID: 0007
Revises: 0006_inventory_pricing_tax_promotions
"""
from alembic import op
import sqlalchemy as sa


revision = '0007_cart_wishlist_checkout_quote'
down_revision = '0006_inventory_pricing_tax_promotions'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "wishlist",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("storefront_id", sa.Uuid(), nullable=False),
        sa.Column("buyer_id", sa.Uuid(), nullable=True),
        sa.Column("anonymous_key", sa.String(length=128), nullable=True),
        sa.Column("name", sa.String(length=200), server_default="My Wishlist", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("(buyer_id IS NULL) <> (anonymous_key IS NULL)", name="wishlist_single_owner"),
        sa.ForeignKeyConstraint(["buyer_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["storefront_id"], ["storefront.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_table(
        "wishlist_item",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("wishlist_id", sa.Uuid(), nullable=False),
        sa.Column("storefront_listing_id", sa.Uuid(), nullable=False),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["storefront_listing_id"], ["storefront_listing.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["wishlist_id"], ["wishlist.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("wishlist_id", "storefront_listing_id", name="uq_wishlist_item_listing")
    )
    op.create_table(
        "customer_address",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("address_type", sa.String(length=32), nullable=False),
        sa.Column("is_default", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("country_code", sa.String(length=2), nullable=False),
        sa.Column("region", sa.String(length=128), nullable=True),
        sa.Column("city", sa.String(length=128), nullable=False),
        sa.Column("postal_code", sa.String(length=32), nullable=False),
        sa.Column("line1", sa.String(length=256), nullable=False),
        sa.Column("line2", sa.String(length=256), nullable=True),
        sa.Column("recipient_name", sa.String(length=200), nullable=False),
        sa.Column("phone_number", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("address_type IN ('BILLING', 'SHIPPING')", name="customer_address_type_values"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_table(
        "shopping_cart",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("storefront_id", sa.Uuid(), nullable=False),
        sa.Column("buyer_id", sa.Uuid(), nullable=True),
        sa.Column("anonymous_key", sa.String(length=128), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="active", nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("(buyer_id IS NULL) <> (anonymous_key IS NULL)", name="shopping_cart_single_owner"),
        sa.CheckConstraint("status IN ('active','converted','abandoned','expired')", name="shopping_cart_status_values"),
        sa.ForeignKeyConstraint(["buyer_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["storefront_id"], ["storefront.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index(
        "uq_shopping_cart_active_buyer", "shopping_cart", ["storefront_id", "buyer_id"], unique=True, postgresql_where=sa.text("status = 'active' AND buyer_id IS NOT NULL")
    )
    op.create_index(
        "uq_shopping_cart_active_anonymous", "shopping_cart", ["storefront_id", "anonymous_key"], unique=True, postgresql_where=sa.text("status = 'active' AND anonymous_key IS NOT NULL")
    )
    op.create_table(
        "shopping_cart_item",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("cart_id", sa.Uuid(), nullable=False),
        sa.Column("storefront_listing_id", sa.Uuid(), nullable=False),
        sa.Column("quantity", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("quantity BETWEEN 1 AND 9007199254740991", name="shopping_cart_item_quantity_bounds"),
        sa.ForeignKeyConstraint(["cart_id"], ["shopping_cart.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["storefront_listing_id"], ["storefront_listing.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cart_id", "storefront_listing_id", name="uq_shopping_cart_item_listing")
    )
    op.create_table(
        "checkout_quote",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("storefront_id", sa.Uuid(), nullable=False),
        sa.Column("buyer_id", sa.Uuid(), nullable=True),
        sa.Column("anonymous_key", sa.String(length=128), nullable=True),
        sa.Column("cart_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(length=32), server_default="DRAFT", nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("subtotal_minor", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("tax_minor", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("shipping_minor", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("discount_minor", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("total_minor", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("quote_signature", sa.String(length=256), nullable=True),
        sa.Column("shipping_address_snapshot", sa.JSON(), nullable=True),
        sa.Column("billing_address_snapshot", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("(buyer_id IS NULL) <> (anonymous_key IS NULL)", name="checkout_quote_single_owner"),
        sa.CheckConstraint("status IN ('DRAFT', 'READY', 'EXPIRED', 'CONVERTED')", name="checkout_quote_status_values"),
        sa.ForeignKeyConstraint(["buyer_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["cart_id"], ["shopping_cart.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["storefront_id"], ["storefront.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_table(
        "checkout_quote_line",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("quote_id", sa.Uuid(), nullable=False),
        sa.Column("variant_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("quantity", sa.BigInteger(), nullable=False),
        sa.Column("unit_price_minor", sa.BigInteger(), nullable=False),
        sa.Column("tax_minor", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("discount_minor", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("total_minor", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("quantity BETWEEN 1 AND 9007199254740991", name="checkout_quote_line_quantity_bounds"),
        sa.ForeignKeyConstraint(["organization_id"], ["seller_organization.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["quote_id"], ["checkout_quote.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["variant_id"], ["product_variant.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_table(
        "checkout_quote_promotion",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("quote_id", sa.Uuid(), nullable=False),
        sa.Column("promotion_id", sa.Uuid(), nullable=False),
        sa.Column("discount_minor", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["promotion_id"], ["promotion.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["quote_id"], ["checkout_quote.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("quote_id", "promotion_id", name="uq_checkout_quote_promotion")
    )


def downgrade():
    raise RuntimeError("Forward-only migrations do not support downgrade")
