"""Canonical PostgreSQL Marketplace schema metadata."""

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    Computed,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import Enum as SAEnum

from .naming import metadata

MAX_SAFE_INTEGER = 9_007_199_254_740_991
LISTING_STATUSES = "'draft','active','paused','rejected','archived'"
ORDER_STATUSES = "'draft','placed','payment_pending','paid','processing','partially_fulfilled','fulfilled','completed','cancelled','partially_cancelled','returned','partially_returned'"
PAYMENT_STATUSES = "'created','requires_action','processing','authorized','captured','failed','cancelled','partially_refunded','refunded'"
FULFILLMENT_STATUSES = "'unfulfilled','allocated','processing','shipped','out_for_delivery','delivered','failed_delivery','returned_to_origin','cancelled'"


def id_column() -> Column:
    return Column("id", Uuid, primary_key=True)


def created_column() -> Column:
    return Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now())


def updated_column() -> Column:
    return Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now())


users = Table(
    "users", metadata, id_column(),
    Column("email", String(320), nullable=False),
    Column("is_active", Boolean, nullable=False, server_default=text("true")),
    Column("is_email_verified", Boolean, nullable=False, server_default=text("false")),
    Column("auth_version", Integer, nullable=False, server_default="1"),
    Column("last_authenticated_at", DateTime(timezone=True)),
    Column("firebase_uid", String(128)),
    Column("phone_number", String(32)),
    Column("full_name", String(150), nullable=False, server_default=""),
    Column("status", SAEnum("active", "suspended", "banned", "pending_verification", name="user_status"), nullable=False, server_default="active"),
    Column("is_phone_verified", Boolean, nullable=False, server_default=text("false")),
    Column("last_login_at", DateTime(timezone=True)),
    Column("metadata", JSONB, nullable=False, server_default=text("'{}'::jsonb")),
    created_column(), updated_column(),
    UniqueConstraint("email", name="uq_users_email"),
    CheckConstraint("email = lower(email)", name="users_email_lower"),
    CheckConstraint("auth_version >= 1", name="users_auth_version_positive"),
)
Index("uq_users_firebase_uid", users.c.firebase_uid, unique=True, postgresql_where=users.c.firebase_uid.is_not(None))
Index("uq_users_phone_number", users.c.phone_number, unique=True, postgresql_where=users.c.phone_number.is_not(None))
Index("idx_users_management_status", users.c.status)
Index("idx_users_management_last_login", users.c.last_login_at.desc())

user_profile = Table(
    "user_profile", metadata, id_column(),
    Column("user_id", Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("name", String(200), nullable=False),
    Column("coin_balance", BigInteger, nullable=False, server_default="0"),
    Column("picture", String(2048)),
    created_column(), updated_column(),
    UniqueConstraint("user_id", name="uq_user_profile_user"),
    CheckConstraint(f"coin_balance BETWEEN 0 AND {MAX_SAFE_INTEGER}", name="user_profile_coin_bounds"),
)

external_identity = Table(
    "external_identity", metadata, id_column(),
    Column("user_id", Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("provider", String(32), nullable=False),
    Column("subject", String(128), nullable=False),
    created_column(), updated_column(),
    UniqueConstraint("provider", "subject", name="uq_external_identity_provider_subject"),
    CheckConstraint("provider IN ('firebase')", name="external_identity_provider_values"),
)

user_auth_providers = Table(
    "user_auth_providers", metadata, id_column(),
    Column("user_id", Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("provider_uid", String(255), nullable=False), Column("provider_email", String(255)),
    Column("linked_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("last_used_at", DateTime(timezone=True)), Column("metadata", JSONB, nullable=False, server_default=text("'{}'::jsonb")),
    UniqueConstraint("user_id"), UniqueConstraint("provider_uid"),
)
Index("idx_user_auth_providers_user", user_auth_providers.c.user_id)

admins = Table(
    "admins", metadata, id_column(),
    Column("email", String(255), nullable=False, unique=True),
    Column("full_name", String(150), nullable=False),
    Column("role", SAEnum("super_admin", "support_admin", "moderator", "compliance_auditor", name="admin_role"), nullable=False, server_default="support_admin"),
    Column("permissions", JSONB, nullable=False, server_default=text("'[]'::jsonb")),
    Column("is_active", Boolean, nullable=False, server_default=text("true")), Column("last_active_at", DateTime(timezone=True)),
    created_column(), updated_column(),
)
Index("idx_admins_email", admins.c.email)
Index("idx_admins_role_active", admins.c.role, admins.c.is_active)

admin_audit_logs = Table(
    "admin_audit_logs", metadata, id_column(),
    Column("admin_id", Uuid, ForeignKey("admins.id", ondelete="SET NULL")),
    Column("action_type", String(100), nullable=False),
    Column("target_user_id", Uuid, ForeignKey("users.id", ondelete="SET NULL")),
    Column("details", JSONB, nullable=False, server_default=text("'{}'::jsonb")),
    Column("ip_address", String(45)), Column("request_id", String(128)), created_column(),
)
Index("idx_admin_audit_admin", admin_audit_logs.c.admin_id)
Index("idx_admin_audit_target", admin_audit_logs.c.target_user_id)
Index("idx_admin_audit_created", admin_audit_logs.c.created_at.desc())
Index("idx_admin_audit_action", admin_audit_logs.c.action_type, admin_audit_logs.c.created_at.desc())

role = Table(
    "role", metadata, id_column(),
    Column("role_key", String(32), nullable=False), Column("display_name", String(64), nullable=False),
    created_column(), updated_column(),
    UniqueConstraint("role_key", name="uq_role_key"),
    CheckConstraint("role_key IN ('buyer','seller','admin')", name="role_key_values"),
)

permission = Table(
    "permission", metadata, id_column(),
    Column("permission_key", String(64), nullable=False), Column("description", String(200), nullable=False),
    created_column(), updated_column(),
    UniqueConstraint("permission_key", name="uq_permission_key"),
)

user_role = Table(
    "user_role", metadata, id_column(),
    Column("user_id", Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("role_id", Uuid, ForeignKey("role.id", ondelete="RESTRICT"), nullable=False),
    created_column(), updated_column(),
    UniqueConstraint("user_id", name="uq_user_role_user"),
    UniqueConstraint("user_id", "role_id", name="uq_user_role_assignment"),
)
Index("ix_user_role_role_user", user_role.c.role_id, user_role.c.user_id)

role_permission = Table(
    "role_permission", metadata, id_column(),
    Column("role_id", Uuid, ForeignKey("role.id", ondelete="CASCADE"), nullable=False),
    Column("permission_id", Uuid, ForeignKey("permission.id", ondelete="CASCADE"), nullable=False),
    created_column(),
    UniqueConstraint("role_id", "permission_id", name="uq_role_permission_assignment"),
)
Index("ix_role_permission_permission_role", role_permission.c.permission_id, role_permission.c.role_id)

buyer_address = Table(
    "buyer_address", metadata, id_column(),
    Column("buyer_id", Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("name", String(200), nullable=False), Column("phone", String(32), nullable=False),
    Column("address_line", String(500), nullable=False), Column("city", String(128), nullable=False),
    Column("state", String(128), nullable=False), Column("pincode", String(24), nullable=False),
    Column("is_default", Boolean, nullable=False, server_default=text("false")), created_column(), updated_column(),
)
Index("uq_buyer_default_address", buyer_address.c.buyer_id, unique=True, postgresql_where=buyer_address.c.is_default.is_(True))

storefront = Table(
    "storefront", metadata, id_column(),
    Column("storefront_key", String(64), nullable=False), Column("display_name", String(128), nullable=False),
    Column("is_active", Boolean, nullable=False, server_default=text("true")),
    Column("currency", String(3), nullable=False), Column("locale", String(16), nullable=False),
    created_column(), updated_column(),
    UniqueConstraint("storefront_key", name="uq_storefront_key"),
    CheckConstraint("storefront_key = lower(storefront_key)", name="storefront_key_lower"),
    CheckConstraint("currency = upper(currency) AND length(currency) = 3", name="storefront_currency_shape"),
)

storefront_domain = Table(
    "storefront_domain", metadata, id_column(),
    Column("storefront_id", Uuid, ForeignKey("storefront.id", ondelete="RESTRICT"), nullable=False),
    Column("hostname", String(253), nullable=False), Column("environment", String(16), nullable=False),
    Column("domain_role", String(16), nullable=False), Column("is_active", Boolean, nullable=False, server_default=text("true")),
    created_column(), updated_column(),
    UniqueConstraint("hostname", name="uq_storefront_domain_hostname"),
    CheckConstraint("hostname = lower(hostname)", name="storefront_domain_hostname_lower"),
    CheckConstraint("hostname LIKE '%.%' AND hostname !~ '[/\\s:*?#@]'", name="storefront_domain_hostname_shape"),
    CheckConstraint("domain_role IN ('primary','alias','development')", name="storefront_domain_role_values"),
    CheckConstraint("environment IN ('production','development','test')", name="storefront_domain_environment_values"),
)
Index(
    "uq_storefront_active_primary_domain", storefront_domain.c.storefront_id, storefront_domain.c.environment,
    unique=True, postgresql_where=(storefront_domain.c.is_active.is_(True) & (storefront_domain.c.domain_role == "primary")),
)

product = Table(
    "product", metadata, id_column(),
    Column("seller_id", Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
    Column("title", String(200), nullable=False), Column("description", Text, nullable=False),
    Column("category", String(100), nullable=False), Column("brand", String(100)),
    Column("is_active", Boolean, nullable=False, server_default=text("true")),
    created_column(), updated_column(),
    UniqueConstraint("id", "seller_id", name="uq_product_id_seller"),
)
Index("ix_product_seller_id_id", product.c.seller_id, product.c.id)

listing = Table(
    "listing", metadata, id_column(),
    Column("storefront_id", Uuid, ForeignKey("storefront.id", ondelete="RESTRICT"), nullable=False),
    Column("product_id", Uuid, nullable=False), Column("seller_id", Uuid, nullable=False),
    Column("price_minor", BigInteger, nullable=False), Column("compare_at_minor", BigInteger),
    Column("currency", String(3), nullable=False), Column("status", String(24), nullable=False, server_default="draft"),
    Column("title_override", String(200)), Column("description_override", Text),
    Column("moderated_by", Uuid, ForeignKey("users.id", ondelete="RESTRICT")),
    Column("moderated_at", DateTime(timezone=True)), Column("moderation_reason", String(500)),
    created_column(), updated_column(),
    ForeignKeyConstraint(["product_id", "seller_id"], ["product.id", "product.seller_id"], ondelete="RESTRICT", name="fk_listing_product_owner"),
    UniqueConstraint("id", "storefront_id", name="uq_listing_id_storefront"),
    UniqueConstraint("id", "storefront_id", "seller_id", name="uq_listing_id_storefront_seller"),
    UniqueConstraint("storefront_id", "seller_id", "product_id", name="uq_listing_storefront_seller_product"),
    CheckConstraint(f"status IN ({LISTING_STATUSES})", name="listing_status_values"),
    CheckConstraint(f"price_minor BETWEEN 0 AND {MAX_SAFE_INTEGER}", name="listing_price_bounds"),
    CheckConstraint(f"compare_at_minor IS NULL OR compare_at_minor BETWEEN price_minor AND {MAX_SAFE_INTEGER}", name="listing_compare_at_bounds"),
    CheckConstraint("currency = upper(currency) AND length(currency) = 3", name="listing_currency_shape"),
)
Index("ix_listing_storefront_seller_id", listing.c.storefront_id, listing.c.seller_id, listing.c.id)
Index("ix_listing_storefront_product", listing.c.storefront_id, listing.c.product_id)

inventory_balance = Table(
    "inventory_balance", metadata, id_column(),
    Column("product_id", Uuid, nullable=False), Column("seller_id", Uuid, nullable=False),
    Column("on_hand_quantity", BigInteger, nullable=False, server_default="0"),
    Column("reserved_quantity", BigInteger, nullable=False, server_default="0"),
    Column("available_quantity", BigInteger, Computed("on_hand_quantity - reserved_quantity", persisted=True)),
    created_column(), updated_column(),
    ForeignKeyConstraint(["product_id", "seller_id"], ["product.id", "product.seller_id"], ondelete="RESTRICT", name="fk_inventory_product_owner"),
    UniqueConstraint("product_id", "seller_id", name="uq_inventory_product_seller"),
    CheckConstraint(f"on_hand_quantity BETWEEN 0 AND {MAX_SAFE_INTEGER}", name="inventory_on_hand_bounds"),
    CheckConstraint(f"reserved_quantity BETWEEN 0 AND {MAX_SAFE_INTEGER}", name="inventory_reserved_bounds"),
    CheckConstraint("reserved_quantity <= on_hand_quantity", name="inventory_reservation_available"),
)
Index("ix_inventory_seller_product", inventory_balance.c.seller_id, inventory_balance.c.product_id)

cart = Table(
    "cart", metadata, id_column(),
    Column("storefront_id", Uuid, ForeignKey("storefront.id", ondelete="RESTRICT"), nullable=False),
    Column("buyer_id", Uuid, ForeignKey("users.id", ondelete="RESTRICT")), Column("anonymous_key", String(128)),
    Column("currency", String(3), nullable=False), Column("status", String(16), nullable=False, server_default="active"),
    Column("version", Integer, nullable=False, server_default="1"), Column("expires_at", DateTime(timezone=True)),
    created_column(), updated_column(),
    UniqueConstraint("id", "storefront_id", name="uq_cart_id_storefront"),
    CheckConstraint("(buyer_id IS NULL) <> (anonymous_key IS NULL)", name="cart_single_owner"),
    CheckConstraint("status IN ('active','converted','abandoned','expired')", name="cart_status_values"),
    CheckConstraint("currency = upper(currency) AND length(currency) = 3", name="cart_currency_shape"),
)
Index("uq_cart_active_buyer", cart.c.storefront_id, cart.c.buyer_id, unique=True, postgresql_where=(cart.c.status == "active") & cart.c.buyer_id.is_not(None))
Index("uq_cart_active_anonymous", cart.c.storefront_id, cart.c.anonymous_key, unique=True, postgresql_where=(cart.c.status == "active") & cart.c.anonymous_key.is_not(None))

cart_item = Table(
    "cart_item", metadata, id_column(),
    Column("cart_id", Uuid, nullable=False), Column("storefront_id", Uuid, nullable=False),
    Column("listing_id", Uuid, nullable=False), Column("quantity", BigInteger, nullable=False),
    created_column(), updated_column(),
    ForeignKeyConstraint(["cart_id", "storefront_id"], ["cart.id", "cart.storefront_id"], ondelete="CASCADE", name="fk_cart_item_cart_storefront"),
    ForeignKeyConstraint(["listing_id", "storefront_id"], ["listing.id", "listing.storefront_id"], ondelete="RESTRICT", name="fk_cart_item_listing_storefront"),
    UniqueConstraint("cart_id", "listing_id", name="uq_cart_item_listing"),
    CheckConstraint(f"quantity BETWEEN 1 AND {MAX_SAFE_INTEGER}", name="cart_item_quantity_bounds"),
)

marketplace_order = Table(
    "marketplace_order", metadata, id_column(),
    Column("storefront_id", Uuid, ForeignKey("storefront.id", ondelete="RESTRICT"), nullable=False),
    Column("buyer_id", Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
    Column("seller_id", Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
    Column("public_order_number", String(64), nullable=False), Column("currency", String(3), nullable=False),
    Column("subtotal_minor", BigInteger, nullable=False), Column("discount_minor", BigInteger, nullable=False, server_default="0"),
    Column("tax_minor", BigInteger, nullable=False, server_default="0"), Column("shipping_minor", BigInteger, nullable=False, server_default="0"),
    Column("total_minor", BigInteger, nullable=False), Column("status", String(32), nullable=False),
    Column("payment_status", String(32), nullable=False, server_default="pending"),
    Column("fulfillment_status", String(32), nullable=False, server_default="unfulfilled"),
    Column("version", Integer, nullable=False, server_default="1"), Column("address_snapshot", JSON, nullable=False),
    created_column(), updated_column(),
    UniqueConstraint("id", "storefront_id", name="uq_order_id_storefront"),
    UniqueConstraint("storefront_id", "public_order_number", name="uq_order_storefront_number"),
    CheckConstraint(f"status IN ({ORDER_STATUSES})", name="order_status_values"),
    CheckConstraint("payment_status IN ('pending','awaiting_verification','authorized','paid','failed','refunded','partially_refunded','voided')", name="order_payment_status_values"),
    CheckConstraint(f"fulfillment_status IN ({FULFILLMENT_STATUSES})", name="order_fulfillment_status_values"),
    CheckConstraint(f"subtotal_minor BETWEEN 0 AND {MAX_SAFE_INTEGER} AND discount_minor BETWEEN 0 AND {MAX_SAFE_INTEGER} AND tax_minor BETWEEN 0 AND {MAX_SAFE_INTEGER} AND shipping_minor BETWEEN 0 AND {MAX_SAFE_INTEGER} AND total_minor BETWEEN 0 AND {MAX_SAFE_INTEGER}", name="order_money_bounds"),
    CheckConstraint("currency = upper(currency) AND length(currency) = 3", name="order_currency_shape"),
)
Index("ix_order_storefront_buyer_created", marketplace_order.c.storefront_id, marketplace_order.c.buyer_id, marketplace_order.c.created_at)
Index("ix_order_storefront_seller_created", marketplace_order.c.storefront_id, marketplace_order.c.seller_id, marketplace_order.c.created_at)

order_item = Table(
    "order_item", metadata, id_column(),
    Column("order_id", Uuid, nullable=False), Column("storefront_id", Uuid, nullable=False),
    Column("listing_id", Uuid, nullable=False), Column("product_id", Uuid, nullable=False),
    Column("seller_id", Uuid, nullable=False), Column("title", String(300), nullable=False),
    Column("unit_price_minor", BigInteger, nullable=False), Column("quantity", BigInteger, nullable=False),
    Column("line_total_minor", BigInteger, nullable=False), Column("snapshot", JSON, nullable=False), created_column(),
    ForeignKeyConstraint(["order_id", "storefront_id"], ["marketplace_order.id", "marketplace_order.storefront_id"], ondelete="RESTRICT", name="fk_order_item_order_storefront"),
    ForeignKeyConstraint(["listing_id", "storefront_id", "seller_id"], ["listing.id", "listing.storefront_id", "listing.seller_id"], ondelete="RESTRICT", name="fk_order_item_listing_scope"),
    CheckConstraint(f"unit_price_minor BETWEEN 0 AND {MAX_SAFE_INTEGER} AND line_total_minor BETWEEN 0 AND {MAX_SAFE_INTEGER}", name="order_item_money_bounds"),
    CheckConstraint(f"quantity BETWEEN 1 AND {MAX_SAFE_INTEGER}", name="order_item_quantity_bounds"),
)

payment_record = Table(
    "payment_record", metadata, id_column(),
    Column("order_id", Uuid, nullable=False), Column("storefront_id", Uuid, nullable=False),
    Column("amount_minor", BigInteger, nullable=False), Column("currency", String(3), nullable=False),
    Column("status", String(32), nullable=False, server_default="created"),
    Column("payment_method_type", String(32)), Column("external_reference", String(256)),
    Column("idempotency_key", String(128), nullable=False), created_column(), updated_column(),
    ForeignKeyConstraint(["order_id", "storefront_id"], ["marketplace_order.id", "marketplace_order.storefront_id"], ondelete="RESTRICT", name="fk_payment_order_storefront"),
    UniqueConstraint("storefront_id", "idempotency_key", name="uq_payment_storefront_idempotency"),
    UniqueConstraint("storefront_id", "external_reference", name="uq_payment_storefront_external_ref"),
    CheckConstraint(f"status IN ({PAYMENT_STATUSES})", name="payment_status_values"),
    CheckConstraint(f"amount_minor BETWEEN 0 AND {MAX_SAFE_INTEGER}", name="payment_amount_bounds"),
)

refund_record = Table(
    "refund_record", metadata, id_column(),
    Column("payment_id", Uuid, ForeignKey("payment_record.id", ondelete="RESTRICT"), nullable=False),
    Column("order_id", Uuid, nullable=False), Column("storefront_id", Uuid, nullable=False),
    Column("amount_minor", BigInteger, nullable=False), Column("currency", String(3), nullable=False),
    Column("status", String(24), nullable=False, server_default="pending"), Column("reason", String(500), nullable=False),
    Column("external_reference", String(256)), Column("idempotency_key", String(128), nullable=False),
    Column("requested_by", Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False), created_column(), updated_column(),
    ForeignKeyConstraint(["order_id", "storefront_id"], ["marketplace_order.id", "marketplace_order.storefront_id"], ondelete="RESTRICT", name="fk_refund_order_storefront"),
    UniqueConstraint("storefront_id", "idempotency_key", name="uq_refund_storefront_idempotency"),
    CheckConstraint("status IN ('pending','processing','succeeded','failed','cancelled')", name="refund_status_values"),
    CheckConstraint(f"amount_minor BETWEEN 1 AND {MAX_SAFE_INTEGER}", name="refund_amount_bounds"),
)

shipment = Table(
    "shipment", metadata, id_column(),
    Column("order_id", Uuid, nullable=False), Column("storefront_id", Uuid, nullable=False),
    Column("seller_id", Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
    Column("status", String(32), nullable=False, server_default="unfulfilled"),
    Column("external_reference", String(256)), Column("service_code", String(128)), created_column(), updated_column(),
    ForeignKeyConstraint(["order_id", "storefront_id"], ["marketplace_order.id", "marketplace_order.storefront_id"], ondelete="RESTRICT", name="fk_shipment_order_storefront"),
    CheckConstraint(f"status IN ({FULFILLMENT_STATUSES})", name="shipment_status_values"),
)
Index("ix_shipment_storefront_seller_order", shipment.c.storefront_id, shipment.c.seller_id, shipment.c.order_id)

idempotency_record = Table(
    "idempotency_record", metadata, id_column(),
    Column("scope", String(128), nullable=False), Column("idempotency_key", String(128), nullable=False),
    Column("request_hash", String(64), nullable=False), Column("resource_type", String(64)), Column("resource_id", Uuid),
    Column("status", String(24), nullable=False), Column("expires_at", DateTime(timezone=True)), created_column(), updated_column(),
    UniqueConstraint("scope", "idempotency_key", name="uq_idempotency_scope_key"),
    CheckConstraint("status IN ('processing','completed','failed')", name="idempotency_status_values"),
)

integration_outbox = Table(
    "integration_outbox", metadata, id_column(),
    Column("storefront_id", Uuid, ForeignKey("storefront.id", ondelete="RESTRICT")),
    Column("event_type", String(128), nullable=False), Column("schema_version", String(16), nullable=False),
    Column("aggregate_type", String(64), nullable=False), Column("aggregate_id", Uuid, nullable=False),
    Column("idempotency_key", String(128), nullable=False), Column("payload", JSON, nullable=False),
    Column("payload_hash", String(64), nullable=False), Column("status", String(24), nullable=False, server_default="pending"),
    Column("attempt_count", Integer, nullable=False, server_default="0"), Column("available_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("published_at", DateTime(timezone=True)), created_column(), updated_column(),
    UniqueConstraint("idempotency_key", name="uq_outbox_idempotency_key"),
    CheckConstraint("status IN ('pending','processing','published','failed')", name="outbox_status_values"),
    CheckConstraint("attempt_count >= 0", name="outbox_attempt_count_nonnegative"),
)
Index("ix_outbox_claim", integration_outbox.c.status, integration_outbox.c.available_at)

external_reference = Table(
    "external_reference", metadata, id_column(),
    Column("system_key", String(64), nullable=False), Column("entity_type", String(64), nullable=False),
    Column("marketplace_id", Uuid, nullable=False), Column("external_id", String(256), nullable=False),
    Column("storefront_id", Uuid, ForeignKey("storefront.id", ondelete="RESTRICT")), created_column(), updated_column(),
    UniqueConstraint("system_key", "entity_type", "marketplace_id", name="uq_external_ref_marketplace"),
    UniqueConstraint("system_key", "entity_type", "external_id", name="uq_external_ref_external"),
)
Index("ix_external_ref_storefront_entity", external_reference.c.storefront_id, external_reference.c.entity_type)

audit_event = Table(
    "audit_event", metadata, id_column(),
    Column("actor_id", Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
    Column("storefront_id", Uuid, ForeignKey("storefront.id", ondelete="RESTRICT")),
    Column("action", String(128), nullable=False), Column("resource_type", String(64), nullable=False),
    Column("resource_id", Uuid, nullable=False), Column("correlation_id", String(128)),
    Column("before_data", JSON), Column("after_data", JSON), created_column(),
)
Index("ix_audit_storefront_resource", audit_event.c.storefront_id, audit_event.c.resource_type, audit_event.c.resource_id)

seller_organization = Table(
    "seller_organization", metadata, id_column(),
    Column("name", String(200), nullable=False),
    Column("slug", String(100), nullable=False),
    Column("status", String(32), nullable=False, server_default="PENDING_VERIFICATION"),
    Column("verification_status", String(32), nullable=False, server_default="UNVERIFIED"),
    Column("onboarding_state", String(32), nullable=False, server_default="DRAFT"),
    Column("metadata", JSON),
    created_column(), updated_column(),
    UniqueConstraint("slug", name="uq_seller_organization_slug"),
    CheckConstraint("status IN ('ACTIVE','SUSPENDED','PENDING_VERIFICATION','REJECTED','INACTIVE')", name="ck_seller_organization_seller_org_status_values"),
    CheckConstraint("verification_status IN ('UNVERIFIED','PENDING','VERIFIED','REJECTED','NEEDS_REVISION')", name="ck_seller_organization_seller_verification_status_values"),
    CheckConstraint("onboarding_state IN ('DRAFT','DOCUMENTS_SUBMITTED','UNDER_REVIEW','COMPLETED','REJECTED')", name="ck_seller_organization_seller_onboarding_state_values"),
    CheckConstraint("slug = lower(trim(slug)) AND length(slug) >= 2", name="ck_seller_organization_slug_shape"),
)
Index("ix_seller_organization_status", seller_organization.c.status, seller_organization.c.verification_status)

seller_org_member = Table(
    "seller_org_member", metadata, id_column(),
    Column("organization_id", Uuid, ForeignKey("seller_organization.id", ondelete="CASCADE"), nullable=False),
    Column("user_id", Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("role", String(32), nullable=False, server_default="MEMBER"),
    Column("permissions", JSON),
    Column("status", String(32), nullable=False, server_default="ACTIVE"),
    Column("joined_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    created_column(), updated_column(),
    UniqueConstraint("organization_id", "user_id", name="uq_seller_org_member_org_user"),
    CheckConstraint("role IN ('OWNER','ADMIN','MANAGER','MEMBER')", name="ck_seller_org_member_member_role_values"),
    CheckConstraint("status IN ('ACTIVE','INVITED','SUSPENDED','REMOVED')", name="ck_seller_org_member_member_status_values"),
)
Index("uq_seller_org_member_active_owner", seller_org_member.c.organization_id, unique=True, postgresql_where=text("role = 'OWNER' AND status = 'ACTIVE'"))
Index("ix_seller_org_member_user_id", seller_org_member.c.user_id, seller_org_member.c.status)
Index("ix_seller_org_member_org_role", seller_org_member.c.organization_id, seller_org_member.c.role, seller_org_member.c.status)

seller_storefront_grant = Table(
    "seller_storefront_grant", metadata, id_column(),
    Column("organization_id", Uuid, ForeignKey("seller_organization.id", ondelete="RESTRICT"), nullable=False),
    Column("storefront_id", Uuid, ForeignKey("storefront.id", ondelete="RESTRICT"), nullable=False),
    Column("grant_status", String(32), nullable=False, server_default="PENDING"),
    Column("granted_by_user_id", Uuid, ForeignKey("users.id", ondelete="RESTRICT")),
    Column("grant_reason", String(500)),
    Column("effective_at", DateTime(timezone=True)),
    Column("revoked_at", DateTime(timezone=True)),
    created_column(), updated_column(),
    CheckConstraint("grant_status IN ('PENDING','APPROVED','REVOKED','SUSPENDED')", name="ck_seller_storefront_grant_status_values"),
)
Index("uq_seller_storefront_grant_active", seller_storefront_grant.c.organization_id, seller_storefront_grant.c.storefront_id, unique=True, postgresql_where=text("grant_status = 'APPROVED'"))
Index("ix_seller_storefront_grant_lookup", seller_storefront_grant.c.organization_id, seller_storefront_grant.c.storefront_id, seller_storefront_grant.c.grant_status)

seller_audit_log = Table(
    "seller_audit_log", metadata, id_column(),
    Column("organization_id", Uuid, ForeignKey("seller_organization.id", ondelete="RESTRICT"), nullable=False),
    Column("actor_user_id", Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
    Column("action", String(128), nullable=False),
    Column("resource_type", String(64), nullable=False),
    Column("resource_id", Uuid, nullable=False),
    Column("payload", JSON),
    created_column(),
)
Index("ix_seller_audit_log_org_created", seller_audit_log.c.organization_id, seller_audit_log.c.created_at)
Index("ix_seller_audit_log_actor", seller_audit_log.c.actor_user_id, seller_audit_log.c.created_at)
Index("ix_seller_audit_log_resource", seller_audit_log.c.resource_type, seller_audit_log.c.resource_id)

seller_verification_history = Table(
    "seller_verification_history", metadata, id_column(),
    Column("organization_id", Uuid, ForeignKey("seller_organization.id", ondelete="RESTRICT"), nullable=False),
    Column("verified_by_user_id", Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
    Column("status", String(32), nullable=False),
    Column("notes", Text),
    created_column(),
    CheckConstraint("status IN ('UNVERIFIED','PENDING','VERIFIED','REJECTED','NEEDS_REVISION','SUSPENDED')", name="ck_seller_verification_history_status_values"),
)
Index("ix_seller_verification_history_org_created", seller_verification_history.c.organization_id, seller_verification_history.c.created_at)

category = Table(
    "category", metadata, id_column(),
    Column("parent_id", Uuid, ForeignKey("category.id", ondelete="RESTRICT")),
    Column("slug", String(100), nullable=False),
    Column("name", String(100), nullable=False),
    Column("is_active", Boolean, nullable=False, server_default=text("true")),
    created_column(), updated_column(),
    UniqueConstraint("slug", name="uq_category_slug"),
)

brand = Table(
    "brand", metadata, id_column(),
    Column("slug", String(100), nullable=False),
    Column("name", String(100), nullable=False),
    created_column(), updated_column(),
    UniqueConstraint("slug", name="uq_brand_slug"),
)

master_product = Table(
    "master_product", metadata, id_column(),
    Column("organization_id", Uuid, ForeignKey("seller_organization.id", ondelete="RESTRICT"), nullable=False),
    Column("brand_id", Uuid, ForeignKey("brand.id", ondelete="RESTRICT")),
    Column("category_id", Uuid, ForeignKey("category.id", ondelete="RESTRICT")),
    Column("slug", String(200), nullable=False),
    Column("name", String(200), nullable=False),
    Column("description", Text),
    Column("tax_class", String(64)),
    Column("lifecycle_status", String(32), nullable=False, server_default="DRAFT"),
    created_column(), updated_column(),
    UniqueConstraint("slug", name="uq_master_product_slug"),
    CheckConstraint("lifecycle_status IN ('DRAFT','ACTIVE','ARCHIVED')", name="ck_master_product_lifecycle_status_values"),
)
Index("ix_master_product_org_status", master_product.c.organization_id, master_product.c.lifecycle_status)

product_attribute = Table(
    "product_attribute", metadata, id_column(),
    Column("product_id", Uuid, ForeignKey("master_product.id", ondelete="CASCADE"), nullable=False),
    Column("name", String(100), nullable=False),
    Column("is_variant_key", Boolean, nullable=False, server_default=text("false")),
    created_column(), updated_column(),
    UniqueConstraint("product_id", "name", name="uq_product_attribute_name"),
)

product_attribute_value = Table(
    "product_attribute_value", metadata, id_column(),
    Column("attribute_id", Uuid, ForeignKey("product_attribute.id", ondelete="CASCADE"), nullable=False),
    Column("value", String(100), nullable=False),
    created_column(), updated_column(),
    UniqueConstraint("attribute_id", "value", name="uq_product_attribute_value"),
)

product_variant = Table(
    "product_variant", metadata, id_column(),
    Column("product_id", Uuid, ForeignKey("master_product.id", ondelete="CASCADE"), nullable=False),
    Column("sku", String(100), nullable=False),
    Column("gtin", String(32)),
    Column("price_reference_minor", BigInteger),
    Column("is_active", Boolean, nullable=False, server_default=text("true")),
    created_column(), updated_column(),
    UniqueConstraint("product_id", "sku", name="uq_product_variant_sku"),
    UniqueConstraint("gtin", name="uq_product_variant_gtin"),
    CheckConstraint(f"price_reference_minor IS NULL OR price_reference_minor BETWEEN 0 AND {MAX_SAFE_INTEGER}", name="ck_product_variant_price_reference_bounds"),
)

variant_attribute_value_map = Table(
    "variant_attribute_value_map", metadata,
    Column("variant_id", Uuid, ForeignKey("product_variant.id", ondelete="CASCADE"), primary_key=True),
    Column("attribute_value_id", Uuid, ForeignKey("product_attribute_value.id", ondelete="CASCADE"), primary_key=True),
)

storefront_listing = Table(
    "storefront_listing", metadata, id_column(),
    Column("storefront_id", Uuid, ForeignKey("storefront.id", ondelete="RESTRICT"), nullable=False),
    Column("organization_id", Uuid, ForeignKey("seller_organization.id", ondelete="RESTRICT"), nullable=False),
    Column("product_id", Uuid, ForeignKey("master_product.id", ondelete="RESTRICT"), nullable=False),
    Column("publication_state", String(32), nullable=False, server_default="DRAFT"),
    Column("listing_content", JSON),
    created_column(), updated_column(),
    UniqueConstraint("storefront_id", "product_id", name="uq_storefront_listing_storefront_product"),
    CheckConstraint("publication_state IN ('DRAFT','PUBLISHED','HIDDEN','SUSPENDED')", name="ck_storefront_listing_publication_state_values"),
)
Index("ix_storefront_listing_org_store", storefront_listing.c.organization_id, storefront_listing.c.storefront_id, storefront_listing.c.publication_state)

media_asset = Table(
    "media_asset", metadata, id_column(),
    Column("organization_id", Uuid, ForeignKey("seller_organization.id", ondelete="RESTRICT"), nullable=False),
    Column("filename", String(256), nullable=False),
    Column("content_type", String(64), nullable=False),
    Column("size_bytes", BigInteger, nullable=False),
    Column("storage_key", String(512), nullable=False),
    Column("status", String(32), nullable=False, server_default="PENDING"),
    created_column(), updated_column(),
    CheckConstraint("status IN ('PENDING','ACTIVE','QUARANTINED','DELETED')", name="ck_media_asset_status_values"),
)
Index("ix_media_asset_org_status", media_asset.c.organization_id, media_asset.c.status)

inventory_ledger = Table(
    "inventory_ledger", metadata, id_column(),
    Column("variant_id", Uuid, ForeignKey("product_variant.id", ondelete="RESTRICT"), nullable=False),
    Column("organization_id", Uuid, ForeignKey("seller_organization.id", ondelete="RESTRICT"), nullable=False),
    Column("on_hand_quantity", BigInteger, nullable=False, server_default="0"),
    Column("reserved_quantity", BigInteger, nullable=False, server_default="0"),
    Column("status", String(32), nullable=False, server_default="ACTIVE"),
    created_column(), updated_column(),
    UniqueConstraint("variant_id", "organization_id", name="uq_inventory_ledger_variant_org"),
    CheckConstraint(f"on_hand_quantity BETWEEN 0 AND {MAX_SAFE_INTEGER}", name="ck_inventory_ledger_on_hand_bounds"),
    CheckConstraint(f"reserved_quantity BETWEEN 0 AND {MAX_SAFE_INTEGER}", name="ck_inventory_ledger_reserved_bounds"),
    CheckConstraint("reserved_quantity <= on_hand_quantity", name="ck_inventory_ledger_reservation_available"),
    CheckConstraint("status IN ('ACTIVE','ARCHIVED')", name="ck_inventory_ledger_status_values"),
)

inventory_reservation = Table(
    "inventory_reservation", metadata, id_column(),
    Column("variant_id", Uuid, ForeignKey("product_variant.id", ondelete="RESTRICT"), nullable=False),
    Column("organization_id", Uuid, ForeignKey("seller_organization.id", ondelete="RESTRICT"), nullable=False),
    Column("quantity", BigInteger, nullable=False),
    Column("status", String(32), nullable=False, server_default="ACTIVE"),
    Column("expires_at", DateTime(timezone=True), nullable=False),
    Column("reference_id", String(128)),
    created_column(), updated_column(),
    CheckConstraint(f"quantity BETWEEN 1 AND {MAX_SAFE_INTEGER}", name="ck_inventory_reservation_quantity_bounds"),
    CheckConstraint("status IN ('ACTIVE','CONSUMED','EXPIRED','RELEASED')", name="ck_inventory_reservation_status_values"),
)
Index("ix_inventory_reservation_variant_status", inventory_reservation.c.variant_id, inventory_reservation.c.status)

inventory_audit_log = Table(
    "inventory_audit_log", metadata, id_column(),
    Column("variant_id", Uuid, ForeignKey("product_variant.id", ondelete="RESTRICT"), nullable=False),
    Column("organization_id", Uuid, ForeignKey("seller_organization.id", ondelete="RESTRICT"), nullable=False),
    Column("change_quantity", BigInteger, nullable=False),
    Column("reason", String(256), nullable=False),
    Column("reference_id", String(128)),
    created_column(),
)
Index("ix_inventory_audit_log_variant", inventory_audit_log.c.variant_id)

price_book = Table(
    "price_book", metadata, id_column(),
    Column("organization_id", Uuid, ForeignKey("seller_organization.id", ondelete="RESTRICT"), nullable=False),
    Column("storefront_id", Uuid, ForeignKey("storefront.id", ondelete="RESTRICT"), nullable=False),
    Column("name", String(200), nullable=False),
    Column("currency", String(3), nullable=False),
    Column("is_active", Boolean, nullable=False, server_default=text("true")),
    created_column(), updated_column(),
    CheckConstraint("currency = upper(currency) AND length(currency) = 3", name="ck_price_book_currency_shape"),
)
Index("ix_price_book_org_storefront", price_book.c.organization_id, price_book.c.storefront_id)

price_record = Table(
    "price_record", metadata, id_column(),
    Column("price_book_id", Uuid, ForeignKey("price_book.id", ondelete="CASCADE"), nullable=False),
    Column("variant_id", Uuid, ForeignKey("product_variant.id", ondelete="RESTRICT"), nullable=False),
    Column("amount", BigInteger, nullable=False),
    Column("compare_at_amount", BigInteger),
    Column("effective_from", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("effective_until", DateTime(timezone=True)),
    created_column(), updated_column(),
    CheckConstraint(f"amount BETWEEN 0 AND {MAX_SAFE_INTEGER}", name="ck_price_record_amount_bounds"),
    CheckConstraint(f"compare_at_amount IS NULL OR compare_at_amount BETWEEN amount AND {MAX_SAFE_INTEGER}", name="ck_price_record_compare_at_bounds"),
)
Index("ix_price_record_book_variant", price_record.c.price_book_id, price_record.c.variant_id)

tax_classification = Table(
    "tax_classification", metadata, id_column(),
    Column("code", String(64), nullable=False),
    Column("name", String(200), nullable=False),
    Column("description", Text),
    created_column(), updated_column(),
    UniqueConstraint("code", name="uq_tax_classification_code"),
)

product_tax_class = Table(
    "product_tax_class", metadata, id_column(),
    Column("master_product_id", Uuid, ForeignKey("master_product.id", ondelete="CASCADE"), nullable=False),
    Column("tax_classification_id", Uuid, ForeignKey("tax_classification.id", ondelete="RESTRICT"), nullable=False),
    created_column(), updated_column(),
    UniqueConstraint("master_product_id", name="uq_product_tax_class_product"),
)

tax_rate = Table(
    "tax_rate", metadata, id_column(),
    Column("storefront_id", Uuid, ForeignKey("storefront.id", ondelete="RESTRICT"), nullable=False),
    Column("tax_classification_id", Uuid, ForeignKey("tax_classification.id", ondelete="RESTRICT"), nullable=False),
    Column("country_code", String(2), nullable=False),
    Column("region_code", String(3)),
    Column("rate", Numeric(5, 4), nullable=False),
    Column("is_active", Boolean, nullable=False, server_default=text("true")),
    Column("effective_from", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("effective_until", DateTime(timezone=True)),
    created_column(), updated_column(),
    CheckConstraint("country_code = upper(country_code) AND length(country_code) = 2", name="ck_tax_rate_country_code_shape"),
)

promotion = Table(
    "promotion", metadata, id_column(),
    Column("organization_id", Uuid, ForeignKey("seller_organization.id", ondelete="RESTRICT"), nullable=False),
    Column("storefront_id", Uuid, ForeignKey("storefront.id", ondelete="RESTRICT"), nullable=False),
    Column("code", String(64)),
    Column("type", String(32), nullable=False),
    Column("value", BigInteger, nullable=False),
    Column("budget_limit", BigInteger),
    Column("budget_used", BigInteger, nullable=False, server_default="0"),
    Column("usage_limit", Integer),
    Column("usage_count", Integer, nullable=False, server_default="0"),
    Column("per_user_limit", Integer),
    Column("minimum_order_value", BigInteger),
    Column("is_active", Boolean, nullable=False, server_default=text("true")),
    Column("effective_from", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("effective_until", DateTime(timezone=True)),
    created_column(), updated_column(),
    UniqueConstraint("code", "storefront_id", name="uq_promotion_code_storefront"),
    CheckConstraint("type IN ('PERCENTAGE','FIXED','SHIPPING')", name="ck_promotion_type_values"),
    CheckConstraint(f"value BETWEEN 0 AND {MAX_SAFE_INTEGER}", name="ck_promotion_value_bounds"),
    CheckConstraint(f"budget_used BETWEEN 0 AND {MAX_SAFE_INTEGER}", name="ck_promotion_budget_used_bounds"),
    CheckConstraint(f"budget_limit IS NULL OR budget_limit BETWEEN 0 AND {MAX_SAFE_INTEGER}", name="ck_promotion_budget_limit_bounds"),
)
Index("ix_promotion_org_storefront", promotion.c.organization_id, promotion.c.storefront_id)

promotion_usage = Table(
    "promotion_usage", metadata, id_column(),
    Column("promotion_id", Uuid, ForeignKey("promotion.id", ondelete="RESTRICT"), nullable=False),
    Column("user_id", Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
    Column("order_id", String(128), nullable=False),
    Column("discount_amount", BigInteger, nullable=False),
    created_column(),
    CheckConstraint(f"discount_amount BETWEEN 0 AND {MAX_SAFE_INTEGER}", name="ck_promotion_usage_discount_bounds"),
)
Index("ix_promotion_usage_promotion_user", promotion_usage.c.promotion_id, promotion_usage.c.user_id)

wishlist = Table(
    "wishlist", metadata, id_column(),
    Column("storefront_id", Uuid, ForeignKey("storefront.id", ondelete="RESTRICT"), nullable=False),
    Column("buyer_id", Uuid, ForeignKey("users.id", ondelete="CASCADE")),
    Column("anonymous_key", String(128)),
    Column("name", String(200), nullable=False, server_default="My Wishlist"),
    created_column(), updated_column(),
    CheckConstraint("(buyer_id IS NULL) <> (anonymous_key IS NULL)", name="wishlist_single_owner"),
)

wishlist_item = Table(
    "wishlist_item", metadata, id_column(),
    Column("wishlist_id", Uuid, ForeignKey("wishlist.id", ondelete="CASCADE"), nullable=False),
    Column("storefront_listing_id", Uuid, ForeignKey("storefront_listing.id", ondelete="CASCADE"), nullable=False),
    Column("added_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    created_column(), updated_column(),
    UniqueConstraint("wishlist_id", "storefront_listing_id", name="uq_wishlist_item_listing"),
)

customer_address = Table(
    "customer_address", metadata, id_column(),
    Column("user_id", Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("address_type", String(32), nullable=False),
    Column("is_default", Boolean, nullable=False, server_default=text("false")),
    Column("country_code", String(2), nullable=False),
    Column("region", String(128)),
    Column("city", String(128), nullable=False),
    Column("postal_code", String(32), nullable=False),
    Column("line1", String(256), nullable=False),
    Column("line2", String(256)),
    Column("recipient_name", String(200), nullable=False),
    Column("phone_number", String(32)),
    created_column(), updated_column(),
    CheckConstraint("address_type IN ('BILLING', 'SHIPPING')", name="customer_address_type_values"),
)

shopping_cart = Table(
    "shopping_cart", metadata, id_column(),
    Column("storefront_id", Uuid, ForeignKey("storefront.id", ondelete="RESTRICT"), nullable=False),
    Column("buyer_id", Uuid, ForeignKey("users.id", ondelete="CASCADE")),
    Column("anonymous_key", String(128)),
    Column("currency", String(3), nullable=False),
    Column("status", String(32), nullable=False, server_default="active"),
    Column("expires_at", DateTime(timezone=True)),
    created_column(), updated_column(),
    CheckConstraint("(buyer_id IS NULL) <> (anonymous_key IS NULL)", name="shopping_cart_single_owner"),
    CheckConstraint("status IN ('active','converted','abandoned','expired')", name="shopping_cart_status_values"),
)
Index("uq_shopping_cart_active_buyer", shopping_cart.c.storefront_id, shopping_cart.c.buyer_id, unique=True, postgresql_where=(shopping_cart.c.status == "active") & shopping_cart.c.buyer_id.is_not(None))
Index("uq_shopping_cart_active_anonymous", shopping_cart.c.storefront_id, shopping_cart.c.anonymous_key, unique=True, postgresql_where=(shopping_cart.c.status == "active") & shopping_cart.c.anonymous_key.is_not(None))

shopping_cart_item = Table(
    "shopping_cart_item", metadata, id_column(),
    Column("cart_id", Uuid, ForeignKey("shopping_cart.id", ondelete="CASCADE"), nullable=False),
    Column("storefront_listing_id", Uuid, ForeignKey("storefront_listing.id", ondelete="RESTRICT"), nullable=False),
    Column("quantity", BigInteger, nullable=False),
    created_column(), updated_column(),
    UniqueConstraint("cart_id", "storefront_listing_id", name="uq_shopping_cart_item_listing"),
    CheckConstraint(f"quantity BETWEEN 1 AND {MAX_SAFE_INTEGER}", name="shopping_cart_item_quantity_bounds"),
)

checkout_quote = Table(
    "checkout_quote", metadata, id_column(),
    Column("storefront_id", Uuid, ForeignKey("storefront.id", ondelete="RESTRICT"), nullable=False),
    Column("buyer_id", Uuid, ForeignKey("users.id", ondelete="CASCADE")),
    Column("anonymous_key", String(128)),
    Column("cart_id", Uuid, ForeignKey("shopping_cart.id", ondelete="SET NULL")),
    Column("status", String(32), nullable=False, server_default="DRAFT"),
    Column("currency", String(3), nullable=False),
    Column("subtotal_minor", BigInteger, nullable=False, server_default="0"),
    Column("tax_minor", BigInteger, nullable=False, server_default="0"),
    Column("shipping_minor", BigInteger, nullable=False, server_default="0"),
    Column("discount_minor", BigInteger, nullable=False, server_default="0"),
    Column("total_minor", BigInteger, nullable=False, server_default="0"),
    Column("expires_at", DateTime(timezone=True)),
    Column("quote_signature", String(256)),
    Column("shipping_address_snapshot", JSON),
    Column("billing_address_snapshot", JSON),
    created_column(), updated_column(),
    CheckConstraint("(buyer_id IS NULL) <> (anonymous_key IS NULL)", name="checkout_quote_single_owner"),
    CheckConstraint("status IN ('DRAFT', 'READY', 'EXPIRED', 'CONVERTED')", name="checkout_quote_status_values"),
)

checkout_quote_line = Table(
    "checkout_quote_line", metadata, id_column(),
    Column("quote_id", Uuid, ForeignKey("checkout_quote.id", ondelete="CASCADE"), nullable=False),
    Column("variant_id", Uuid, ForeignKey("product_variant.id", ondelete="RESTRICT"), nullable=False),
    Column("organization_id", Uuid, ForeignKey("seller_organization.id", ondelete="RESTRICT"), nullable=False),
    Column("quantity", BigInteger, nullable=False),
    Column("unit_price_minor", BigInteger, nullable=False),
    Column("tax_minor", BigInteger, nullable=False, server_default="0"),
    Column("discount_minor", BigInteger, nullable=False, server_default="0"),
    Column("total_minor", BigInteger, nullable=False),
    created_column(), updated_column(),
    CheckConstraint(f"quantity BETWEEN 1 AND {MAX_SAFE_INTEGER}", name="checkout_quote_line_quantity_bounds"),
)

checkout_quote_promotion = Table(
    "checkout_quote_promotion", metadata, id_column(),
    Column("quote_id", Uuid, ForeignKey("checkout_quote.id", ondelete="CASCADE"), nullable=False),
    Column("promotion_id", Uuid, ForeignKey("promotion.id", ondelete="RESTRICT"), nullable=False),
    Column("discount_minor", BigInteger, nullable=False),
    created_column(), updated_column(),
    UniqueConstraint("quote_id", "promotion_id", name="uq_checkout_quote_promotion"),
)

payment_webhook_receipt = Table(
    "payment_webhook_receipt", metadata, id_column(),
    Column("storefront_id", Uuid, ForeignKey("storefront.id", ondelete="RESTRICT"), nullable=False),
    Column("provider", String(64), nullable=False),
    Column("external_event_id", String(256), nullable=False),
    Column("status", String(32), nullable=False, server_default="unprocessed"),
    Column("payload", JSON, nullable=False),
    Column("signature", String(512)),
    created_column(), updated_column(),
    UniqueConstraint("provider", "external_event_id", name="uq_payment_webhook_receipt_event"),
    CheckConstraint("status IN ('unprocessed','processed','failed')", name="payment_webhook_receipt_status_values"),
)

payment_transaction_ledger = Table(
    "payment_transaction_ledger", metadata, id_column(),
    Column("payment_record_id", Uuid, ForeignKey("payment_record.id", ondelete="RESTRICT"), nullable=False),
    Column("type", String(32), nullable=False),
    Column("amount_minor", BigInteger, nullable=False),
    Column("currency", String(3), nullable=False),
    created_column(),
    CheckConstraint("type IN ('AUTHORIZATION','CAPTURE','REFUND','VOID','FAILURE')", name="payment_transaction_ledger_type_values"),
    CheckConstraint(f"amount_minor BETWEEN 0 AND {MAX_SAFE_INTEGER}", name="payment_transaction_ledger_amount_bounds"),
    CheckConstraint("currency = upper(currency) AND length(currency) = 3", name="payment_transaction_ledger_currency_shape"),
)

order_state_history = Table(
    "order_state_history", metadata, id_column(),
    Column("order_id", Uuid, ForeignKey("marketplace_order.id", ondelete="CASCADE"), nullable=False),
    Column("previous_status", String(32)),
    Column("new_status", String(32), nullable=False),
    Column("reason", String(500)),
    Column("actor_id", Uuid, ForeignKey("users.id", ondelete="RESTRICT")),
    created_column(),
    CheckConstraint(f"new_status IN ({ORDER_STATUSES})", name="order_state_history_new_status_values"),
)

fulfillment_record = Table(
    "fulfillment_record", metadata, id_column(),
    Column("order_id", Uuid, ForeignKey("marketplace_order.id", ondelete="RESTRICT"), nullable=False),
    Column("storefront_id", Uuid, ForeignKey("storefront.id", ondelete="RESTRICT"), nullable=False),
    Column("status", String(32), nullable=False, server_default="processing"),
    created_column(), updated_column(),
    CheckConstraint(f"status IN ({FULFILLMENT_STATUSES})", name="fulfillment_record_status_values"),
)

shipment_line = Table(
    "shipment_line", metadata, id_column(),
    Column("shipment_id", Uuid, ForeignKey("shipment.id", ondelete="CASCADE"), nullable=False),
    Column("order_item_id", Uuid, ForeignKey("order_item.id", ondelete="RESTRICT"), nullable=False),
    Column("quantity", BigInteger, nullable=False),
    created_column(),
    CheckConstraint(f"quantity BETWEEN 1 AND {MAX_SAFE_INTEGER}", name="shipment_line_quantity_bounds"),
)

shipment_tracking_event = Table(
    "shipment_tracking_event", metadata, id_column(),
    Column("shipment_id", Uuid, ForeignKey("shipment.id", ondelete="CASCADE"), nullable=False),
    Column("status", String(32), nullable=False),
    Column("location", String(200)),
    Column("description", String(500)),
    Column("timestamp", DateTime(timezone=True), nullable=False, server_default=func.now()),
    created_column(),
    CheckConstraint(f"status IN ({FULFILLMENT_STATUSES})", name="shipment_tracking_event_status_values"),
)

return_request = Table(
    "return_request", metadata, id_column(),
    Column("order_id", Uuid, ForeignKey("marketplace_order.id", ondelete="RESTRICT"), nullable=False),
    Column("storefront_id", Uuid, ForeignKey("storefront.id", ondelete="RESTRICT"), nullable=False),
    Column("buyer_id", Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
    Column("status", String(32), nullable=False, server_default="pending"),
    Column("reason", String(500)),
    Column("refund_amount_minor", BigInteger, nullable=False, server_default="0"),
    created_column(), updated_column(),
    CheckConstraint("status IN ('pending','approved','rejected','completed')", name="return_request_status_values"),
    CheckConstraint(f"refund_amount_minor BETWEEN 0 AND {MAX_SAFE_INTEGER}", name="return_request_refund_amount_bounds"),
)

return_authorization = Table(
    "return_authorization", metadata, id_column(),
    Column("return_request_id", Uuid, ForeignKey("return_request.id", ondelete="RESTRICT"), nullable=False),
    Column("status", String(32), nullable=False, server_default="issued"),
    Column("rma_number", String(64), nullable=False),
    Column("instructions", Text),
    created_column(), updated_column(),
    UniqueConstraint("rma_number", name="uq_return_authorization_rma"),
    CheckConstraint("status IN ('issued','received','processed')", name="return_authorization_status_values"),
)

dispute_reason = Table(
    "dispute_reason", metadata, id_column(),
    Column("code", String(64), nullable=False),
    Column("description", String(500)),
    created_column(), updated_column(),
    UniqueConstraint("code", name="uq_dispute_reason_code"),
)

dispute = Table(
    "dispute", metadata, id_column(),
    Column("order_id", Uuid, ForeignKey("marketplace_order.id", ondelete="RESTRICT"), nullable=False),
    Column("storefront_id", Uuid, ForeignKey("storefront.id", ondelete="RESTRICT"), nullable=False),
    Column("reason_id", Uuid, ForeignKey("dispute_reason.id", ondelete="RESTRICT"), nullable=False),
    Column("status", String(32), nullable=False, server_default="opened"),
    Column("resolution", String(500)),
    created_column(), updated_column(),
    CheckConstraint("status IN ('opened','under_review','resolved','closed')", name="dispute_status_values"),
)

ALL_TABLES = tuple(metadata.sorted_tables)


erp_inbox = Table(
    "erp_inbox", metadata, id_column(),
    Column("external_event_id", String(128), nullable=False),
    Column("event_type", String(128), nullable=False),
    Column("schema_version", String(16), nullable=False),
    Column("payload_hash", String(64), nullable=False),
    Column("processing_status", String(24), nullable=False),
    Column("correlation_id", String(64)),
    Column("failure_category", String(64)),
    Column("received_at", DateTime(timezone=True), nullable=False),
    Column("processed_at", DateTime(timezone=True)),
)

erp_outbox = Table(
    "erp_outbox", metadata, id_column(),
    Column("event_type", String(128), nullable=False),
    Column("schema_version", String(16), nullable=False),
    Column("aggregate_type", String(64), nullable=False),
    Column("aggregate_id", Uuid, nullable=False),
    Column("storefront_id", Uuid, ForeignKey("storefront.id", ondelete="RESTRICT")),
    Column("correlation_id", String(64)),
    Column("causation_id", String(64)),
    Column("idempotency_key", String(128), nullable=False),
    Column("payload_json", Text, nullable=False),
    Column("payload_hash", String(64), nullable=False),
    Column("status", String(24), nullable=False, server_default="pending"),
    Column("attempt_count", Integer, nullable=False, server_default="0"),
    Column("available_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("next_attempt_at", DateTime(timezone=True)),
    Column("published_at", DateTime(timezone=True)),
    Column("lease_owner", String(128)),
    Column("lease_until", DateTime(timezone=True)),
    created_column(), updated_column(),
    UniqueConstraint("idempotency_key", name="uq_erp_outbox_idempotency_key"),
    CheckConstraint("status IN ('pending','processing','published','failed')", name="erp_outbox_status_values"),
    CheckConstraint("attempt_count >= 0", name="erp_outbox_attempt_count_nonnegative"),
)
Index("ix_erp_outbox_claim", erp_outbox.c.status, erp_outbox.c.available_at, erp_outbox.c.next_attempt_at)
