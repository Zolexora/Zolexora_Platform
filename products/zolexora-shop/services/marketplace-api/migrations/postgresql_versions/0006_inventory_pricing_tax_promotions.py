"""inventory pricing tax promotions

Revision ID: 0006
Revises: 0005_master_catalog_and_listings
"""
from alembic import op
import sqlalchemy as sa


revision = '0006_inventory_pricing_tax_promotions'
down_revision = '0005_master_catalog_and_listings'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "tax_classification",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_tax_classification_code"),
    )

    op.create_table(
        "product_tax_class",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("master_product_id", sa.Uuid(), nullable=False),
        sa.Column("tax_classification_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["master_product_id"], ["master_product.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tax_classification_id"], ["tax_classification.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("master_product_id", name="uq_product_tax_class_product"),
    )

    op.create_table(
        "tax_rate",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("storefront_id", sa.Uuid(), nullable=False),
        sa.Column("tax_classification_id", sa.Uuid(), nullable=False),
        sa.Column("country_code", sa.String(2), nullable=False),
        sa.Column("region_code", sa.String(3)),
        sa.Column("rate", sa.Numeric(5, 4), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("effective_until", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["storefront_id"], ["storefront.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["tax_classification_id"], ["tax_classification.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("country_code = upper(country_code) AND length(country_code) = 2", name="ck_tax_rate_country_code_shape"),
    )

    op.create_table(
        "inventory_ledger",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("variant_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("on_hand_quantity", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("reserved_quantity", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(32), nullable=False, server_default="ACTIVE"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["organization_id"], ["seller_organization.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["variant_id"], ["product_variant.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("variant_id", "organization_id", name="uq_inventory_ledger_variant_org"),
        sa.CheckConstraint("on_hand_quantity BETWEEN 0 AND 9007199254740991", name="ck_inventory_ledger_on_hand_bounds"),
        sa.CheckConstraint("reserved_quantity <= on_hand_quantity", name="ck_inventory_ledger_reservation_available"),
        sa.CheckConstraint("reserved_quantity BETWEEN 0 AND 9007199254740991", name="ck_inventory_ledger_reserved_bounds"),
        sa.CheckConstraint("status IN ('ACTIVE','ARCHIVED')", name="ck_inventory_ledger_status_values"),
    )

    op.create_table(
        "inventory_reservation",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("variant_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("quantity", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="ACTIVE"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reference_id", sa.String(128)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["organization_id"], ["seller_organization.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["variant_id"], ["product_variant.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("quantity BETWEEN 1 AND 9007199254740991", name="ck_inventory_reservation_quantity_bounds"),
        sa.CheckConstraint("status IN ('ACTIVE','CONSUMED','EXPIRED','RELEASED')", name="ck_inventory_reservation_status_values"),
    )
    op.create_index("ix_inventory_reservation_variant_status", "inventory_reservation", ["variant_id", "status"])

    op.create_table(
        "inventory_audit_log",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("variant_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("change_quantity", sa.BigInteger(), nullable=False),
        sa.Column("reason", sa.String(256), nullable=False),
        sa.Column("reference_id", sa.String(128)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["organization_id"], ["seller_organization.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["variant_id"], ["product_variant.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_inventory_audit_log_variant", "inventory_audit_log", ["variant_id"])

    op.create_table(
        "price_book",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("storefront_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["organization_id"], ["seller_organization.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["storefront_id"], ["storefront.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("currency = upper(currency) AND length(currency) = 3", name="ck_price_book_currency_shape"),
    )
    op.create_index("ix_price_book_org_storefront", "price_book", ["organization_id", "storefront_id"])

    op.create_table(
        "price_record",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("price_book_id", sa.Uuid(), nullable=False),
        sa.Column("variant_id", sa.Uuid(), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("compare_at_amount", sa.BigInteger()),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("effective_until", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["price_book_id"], ["price_book.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["variant_id"], ["product_variant.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("amount BETWEEN 0 AND 9007199254740991", name="ck_price_record_amount_bounds"),
        sa.CheckConstraint("compare_at_amount IS NULL OR compare_at_amount BETWEEN amount AND 9007199254740991", name="ck_price_record_compare_at_bounds"),
    )
    op.create_index("ix_price_record_book_variant", "price_record", ["price_book_id", "variant_id"])

    op.create_table(
        "promotion",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("storefront_id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(64)),
        sa.Column("type", sa.String(32), nullable=False),
        sa.Column("value", sa.BigInteger(), nullable=False),
        sa.Column("budget_limit", sa.BigInteger()),
        sa.Column("budget_used", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("usage_limit", sa.Integer()),
        sa.Column("usage_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("per_user_limit", sa.Integer()),
        sa.Column("minimum_order_value", sa.BigInteger()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("effective_until", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["organization_id"], ["seller_organization.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["storefront_id"], ["storefront.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", "storefront_id", name="uq_promotion_code_storefront"),
        sa.CheckConstraint("budget_limit IS NULL OR budget_limit BETWEEN 0 AND 9007199254740991", name="ck_promotion_budget_limit_bounds"),
        sa.CheckConstraint("budget_used BETWEEN 0 AND 9007199254740991", name="ck_promotion_budget_used_bounds"),
        sa.CheckConstraint("type IN ('PERCENTAGE','FIXED','SHIPPING')", name="ck_promotion_type_values"),
        sa.CheckConstraint("value BETWEEN 0 AND 9007199254740991", name="ck_promotion_value_bounds"),
    )
    op.create_index("ix_promotion_org_storefront", "promotion", ["organization_id", "storefront_id"])

    op.create_table(
        "promotion_usage",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("promotion_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("order_id", sa.String(128), nullable=False),
        sa.Column("discount_amount", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["promotion_id"], ["promotion.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("discount_amount BETWEEN 0 AND 9007199254740991", name="ck_promotion_usage_discount_bounds"),
    )
    op.create_index("ix_promotion_usage_promotion_user", "promotion_usage", ["promotion_id", "user_id"])


def downgrade():
    raise RuntimeError("Forward-only migrations do not support downgrade")
