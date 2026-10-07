import asyncio
import os
import subprocess
import uuid
from dataclasses import dataclass
from pathlib import Path

import asyncpg
import pytest
from alembic import command
from alembic.config import Config
from httpx import ASGITransport, AsyncClient

from database.config import DatabaseConfig
from database.engine import SCHEMA_HEAD, check_readiness
from database.repositories.catalog import PostgresCatalogRepository
from database.repositories.storefronts import PostgresStorefrontRepository, bootstrap_storefronts
from main import app as marketplace_app
from storefronts.models import StorefrontKey

ROOT = Path(__file__).parents[3]
API = ROOT / "services/marketplace-api"
COMPOSE = ROOT / "infrastructure/docker/postgres-test.compose.yml"
TEST_URL = "postgresql://marketplace_local:marketplace-local-only@127.0.0.1:5432/marketplace_local"
REQUIRED_TABLES = {
    "users", "buyer_address", "storefront", "storefront_domain", "product", "listing",
    "inventory_balance", "cart", "cart_item", "marketplace_order", "order_item",
    "payment_record", "refund_record", "shipment", "idempotency_record",
    "integration_outbox", "external_reference", "audit_event", "alembic_version",
    "user_profile", "role", "permission", "user_role", "role_permission",
    "seller_organization", "seller_org_member", "seller_storefront_grant",
    "seller_audit_log", "seller_verification_history",
    "category", "brand", "master_product", "product_attribute", "product_attribute_value",
    "product_variant", "variant_attribute_value_map", "storefront_listing", "media_asset",
    "tax_classification", "product_tax_class", "tax_rate",
    "inventory_ledger", "inventory_reservation", "inventory_audit_log",
    "price_book", "price_record", "promotion", "promotion_usage",
    "wishlist", "wishlist_item", "customer_address", "shopping_cart", "shopping_cart_item",
    "checkout_quote", "checkout_quote_line", "checkout_quote_promotion",
    "payment_webhook_receipt", "payment_transaction_ledger",
    "order_state_history", "fulfillment_record", "shipment_line", "shipment_tracking_event",
    "return_request", "return_authorization", "dispute_reason", "dispute",
    "erp_outbox", "erp_inbox",
}



@dataclass(frozen=True)
class MigrationEvidence:
    first: tuple
    second: tuple
    revision: str


async def _reset_database() -> None:
    connection = await asyncpg.connect(TEST_URL)
    try:
        await connection.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public")
    finally:
        await connection.close()


async def _schema_fingerprint() -> tuple:
    connection = await asyncpg.connect(TEST_URL)
    try:
        tables = tuple(await connection.fetchval("SELECT array_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname='public'"))
        constraints = tuple(await connection.fetchval("SELECT array_agg(conname ORDER BY conname) FROM pg_constraint WHERE connamespace='public'::regnamespace"))
        indexes = tuple(await connection.fetchval("SELECT array_agg(indexname ORDER BY indexname) FROM pg_indexes WHERE schemaname='public'"))
        revision = await connection.fetchval("SELECT version_num FROM alembic_version")
        return tables, constraints, indexes, revision
    finally:
        await connection.close()


@pytest.fixture(scope="module")
def postgres_database() -> MigrationEvidence:
    subprocess.run(["docker", "compose", "-f", str(COMPOSE), "up", "-d", "--wait"], check=True, cwd=ROOT)
    os.environ["DATABASE_URL"] = TEST_URL
    asyncio.run(_reset_database())
    config = Config(str(API / "alembic.ini"))
    command.upgrade(config, "head")
    first = asyncio.run(_schema_fingerprint())
    command.upgrade(config, "head")
    second = asyncio.run(_schema_fingerprint())
    try:
        yield MigrationEvidence(first, second, first[3])
    finally:
        subprocess.run(["docker", "compose", "-f", str(COMPOSE), "down", "--volumes"], check=True, cwd=ROOT)


@pytest.fixture
async def db_connection(postgres_database):
    connection = await asyncpg.connect(TEST_URL)
    transaction = connection.transaction()
    await transaction.start()
    try:
        yield connection
    finally:
        await transaction.rollback()
        await connection.close()


def test_database_config_accepts_standard_postgresql_url():
    value = DatabaseConfig("postgresql://user:value@localhost/marketplace", pool_min=2, pool_max=7)
    assert value.asyncpg_url.startswith("postgresql://")


@pytest.mark.parametrize("url", ["", "sqlite:///local.db", "oracle+oracledb://host/service", "postgresql:///missing-host"])
def test_database_config_rejects_non_postgresql_or_incomplete_urls(url):
    with pytest.raises(ValueError):
        DatabaseConfig(url)


def test_database_config_repr_redacts_complete_url():
    rendered = repr(DatabaseConfig("postgresql://user:sensitive@localhost/marketplace"))
    assert "sensitive" not in rendered and rendered == "DatabaseConfig(url=<redacted>)"


def test_pool_bounds_are_validated():
    with pytest.raises(ValueError):
        DatabaseConfig("postgresql://user:value@localhost/marketplace", pool_min=5, pool_max=2)


def test_empty_database_upgrades_to_head(postgres_database):
    tables = set(postgres_database.first[0])
    assert REQUIRED_TABLES == tables and postgres_database.revision == SCHEMA_HEAD


def test_second_upgrade_to_head_is_schema_noop(postgres_database):
    assert postgres_database.second == postgres_database.first


def test_required_constraints_and_indexes_exist(postgres_database):
    constraints, indexes = set(postgres_database.first[1]), set(postgres_database.first[2])
    assert {"fk_listing_product_owner", "fk_cart_item_listing_storefront", "fk_order_item_listing_scope", "ck_inventory_balance_inventory_on_hand_bounds"} <= constraints
    assert {"ix_listing_storefront_seller_id", "ix_order_storefront_buyer_created", "uq_idempotency_scope_key", "ix_outbox_claim"} <= indexes | constraints


def test_active_migration_chain_has_one_postgresql_head(postgres_database):
    config = Config(str(API / "alembic.ini"))
    heads = command.heads(config)
    assert heads is None and postgres_database.revision == "0010_erp_outbox_inbox"



async def _seed_catalog(connection):
    seller_a, seller_b, buyer = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    store_a, store_b = uuid.uuid4(), uuid.uuid4()
    product_id, listing_id, inventory_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    await connection.executemany(
        "INSERT INTO users (id,email) VALUES ($1,$2)",
        [(seller_a, f"{seller_a}@example.test"), (seller_b, f"{seller_b}@example.test"), (buyer, f"{buyer}@example.test")],
    )
    await connection.executemany(
        "INSERT INTO user_profile (id,user_id,name) VALUES ($1,$1,$2)",
        [(seller_a, "Seller A"), (seller_b, "Seller B"), (buyer, "Buyer")],
    )
    await connection.executemany(
        "INSERT INTO storefront (id,storefront_key,display_name,currency,locale) VALUES ($1,$2,$3,'INR','en-IN')",
        [(store_a, f"store-{store_a.hex}", "Store A"), (store_b, f"store-{store_b.hex}", "Store B")],
    )
    await connection.execute(
        "INSERT INTO product (id,seller_id,title,description,category) VALUES ($1,$2,'Product','Description','Other')",
        product_id, seller_a,
    )
    await connection.execute(
        "INSERT INTO listing (id,storefront_id,product_id,seller_id,price_minor,currency,status) VALUES ($1,$2,$3,$4,1000,'INR','active')",
        listing_id, store_a, product_id, seller_a,
    )
    await connection.execute(
        "INSERT INTO inventory_balance (id,product_id,seller_id,on_hand_quantity,reserved_quantity) VALUES ($1,$2,$3,10,0)",
        inventory_id, product_id, seller_a,
    )
    return seller_a, seller_b, buyer, store_a, store_b, product_id, listing_id


@pytest.mark.asyncio
async def test_database_populates_utc_timestamps(db_connection):
    seller, *_ = await _seed_catalog(db_connection)
    created = await db_connection.fetchval("SELECT created_at FROM users WHERE id=$1", seller)
    timezone_name = await db_connection.fetchval("SHOW timezone")
    assert created.tzinfo is not None and created.utcoffset().total_seconds() == 0 and timezone_name in ("UTC", "Etc/UTC")


@pytest.mark.asyncio
async def test_updated_at_is_server_controlled(db_connection):
    seller, *_ = await _seed_catalog(db_connection)
    before = await db_connection.fetchval("SELECT updated_at FROM user_profile WHERE user_id=$1", seller)
    await db_connection.execute("UPDATE user_profile SET name='Changed' WHERE user_id=$1", seller)
    after = await db_connection.fetchval("SELECT updated_at FROM user_profile WHERE user_id=$1", seller)
    assert after >= before


@pytest.mark.asyncio
async def test_storefront_bootstrap_is_deterministic_and_idempotent(db_connection):
    await db_connection.execute("TRUNCATE storefront CASCADE")
    dry_run = await bootstrap_storefronts(db_connection, dry_run=True)
    assert len(dry_run) == 7 and await db_connection.fetchval("SELECT count(*) FROM storefront") == 0
    applied = await bootstrap_storefronts(db_connection, dry_run=False)
    repeated = await bootstrap_storefronts(db_connection, dry_run=False)
    assert applied == dry_run and repeated == []


@pytest.mark.asyncio
async def test_postgresql_storefront_repository_loads_exact_registry(db_connection):
    await bootstrap_storefronts(db_connection, dry_run=False)
    registry = await PostgresStorefrontRepository(db_connection, development=True).load_registry()
    assert registry.by_host("shop.zolexora.com").key == StorefrontKey.ZOLEXORA_SHOP
    assert registry.by_host("shop.zolexora.com.evil") is None


@pytest.mark.asyncio
async def test_invalid_foreign_key_fails(db_connection):
    with pytest.raises(asyncpg.ForeignKeyViolationError):
        async with db_connection.transaction():
            await db_connection.execute(
                "INSERT INTO product (id,seller_id,title,description,category) VALUES ($1,$2,'x','x','x')",
                uuid.uuid4(), uuid.uuid4(),
            )


@pytest.mark.asyncio
async def test_duplicate_scoped_listing_fails(db_connection):
    seller, _, _, store, _, product, _ = await _seed_catalog(db_connection)
    with pytest.raises(asyncpg.UniqueViolationError):
        async with db_connection.transaction():
            await db_connection.execute(
                "INSERT INTO listing (id,storefront_id,product_id,seller_id,price_minor,currency,status) VALUES ($1,$2,$3,$4,1000,'INR','draft')",
                uuid.uuid4(), store, product, seller,
            )


@pytest.mark.asyncio
async def test_cross_storefront_cart_relationship_fails(db_connection):
    seller, _, buyer, store_a, store_b, _, listing = await _seed_catalog(db_connection)
    cart_id = uuid.uuid4()
    await db_connection.execute("INSERT INTO cart (id,storefront_id,buyer_id,currency) VALUES ($1,$2,$3,'INR')", cart_id, store_b, buyer)
    with pytest.raises(asyncpg.ForeignKeyViolationError):
        async with db_connection.transaction():
            await db_connection.execute(
                "INSERT INTO cart_item (id,cart_id,storefront_id,listing_id,quantity) VALUES ($1,$2,$3,$4,1)",
                uuid.uuid4(), cart_id, store_b, listing,
            )
    assert seller


@pytest.mark.parametrize("quantity", [-1, 9_007_199_254_740_992])
@pytest.mark.asyncio
async def test_inventory_bounds_fail(db_connection, quantity):
    seller, *_rest, product, _listing = await _seed_catalog(db_connection)
    with pytest.raises(asyncpg.CheckViolationError):
        async with db_connection.transaction():
            await db_connection.execute(
                "UPDATE inventory_balance SET on_hand_quantity=$1 WHERE product_id=$2 AND seller_id=$3",
                quantity, product, seller,
            )


@pytest.mark.parametrize(
    ("table", "column", "value"),
    [("listing", "status", "approved"), ("marketplace_order", "status", "unknown"), ("payment_record", "status", "paid")],
)
@pytest.mark.asyncio
async def test_invalid_lifecycle_values_fail(db_connection, table, column, value):
    seller, _, buyer, store, _, product, listing = await _seed_catalog(db_connection)
    if table == "listing":
        query, args = f"UPDATE listing SET {column}=$1 WHERE id=$2", (value, listing)
    else:
        order = uuid.uuid4()
        await db_connection.execute(
            "INSERT INTO marketplace_order (id,storefront_id,buyer_id,seller_id,public_order_number,currency,subtotal_minor,total_minor,status,address_snapshot) VALUES ($1,$2,$3,$4,$5,'INR',100,100,'placed','{}')",
            order, store, buyer, seller, str(order),
        )
        if table == "marketplace_order":
            query, args = f"UPDATE marketplace_order SET {column}=$1 WHERE id=$2", (value, order)
        else:
            query, args = "INSERT INTO payment_record (id,order_id,storefront_id,amount_minor,currency,status,idempotency_key) VALUES ($1,$2,$3,100,'INR',$4,$5)", (uuid.uuid4(), order, store, value, str(uuid.uuid4()))
    with pytest.raises(asyncpg.CheckViolationError):
        async with db_connection.transaction():
            await db_connection.execute(query, *args)
    assert product


@pytest.mark.parametrize("amount", [-1, 9_007_199_254_740_992])
@pytest.mark.asyncio
async def test_money_bounds_fail(db_connection, amount):
    seller, _, _, store, _, product, listing = await _seed_catalog(db_connection)
    with pytest.raises(asyncpg.CheckViolationError):
        async with db_connection.transaction():
            await db_connection.execute("UPDATE listing SET price_minor=$1 WHERE id=$2 AND storefront_id=$3 AND seller_id=$4", amount, listing, store, seller)
    assert product


@pytest.mark.asyncio
async def test_successful_unit_of_work_commits_atomically(postgres_database):
    connection = await asyncpg.connect(TEST_URL)
    user_id = uuid.uuid4()
    try:
        async with connection.transaction():
            await connection.execute("INSERT INTO users (id,email) VALUES ($1,$2)", user_id, f"{user_id}@example.test")
        assert await connection.fetchval("SELECT count(*) FROM users WHERE id=$1", user_id) == 1
        await connection.execute("DELETE FROM users WHERE id=$1", user_id)
    finally:
        await connection.close()


@pytest.mark.asyncio
async def test_failed_multi_write_rolls_back_fully(postgres_database):
    connection = await asyncpg.connect(TEST_URL)
    user_id = uuid.uuid4()
    try:
        with pytest.raises(asyncpg.UniqueViolationError):
            async with connection.transaction():
                await connection.execute("INSERT INTO users (id,email) VALUES ($1,$2)", user_id, f"{user_id}@example.test")
                await connection.execute("INSERT INTO users (id,email) VALUES ($1,$2)", uuid.uuid4(), f"{user_id}@example.test")
        assert await connection.fetchval("SELECT count(*) FROM users WHERE id=$1", user_id) == 0
    finally:
        await connection.close()


@pytest.mark.asyncio
async def test_explicit_rollback_leaves_no_partial_rows_and_connection_reusable(postgres_database):
    connection = await asyncpg.connect(TEST_URL)
    user_id = uuid.uuid4()
    transaction = connection.transaction()
    try:
        await transaction.start()
        await connection.execute("INSERT INTO users (id,email) VALUES ($1,$2)", user_id, f"{user_id}@example.test")
        await transaction.rollback()
        assert await connection.fetchval("SELECT count(*) FROM users WHERE id=$1", user_id) == 0
        assert await connection.fetchval("SELECT 1") == 1
    finally:
        await connection.close()


@pytest.mark.asyncio
async def test_scoped_repository_lookup_and_deterministic_pagination(db_connection):
    seller, _, _, store, _, product, listing = await _seed_catalog(db_connection)
    second = uuid.uuid4()
    second_product = uuid.uuid4()
    await db_connection.execute("INSERT INTO product (id,seller_id,title,description,category) VALUES ($1,$2,'Second','Description','Other')", second_product, seller)
    await db_connection.execute("INSERT INTO listing (id,storefront_id,product_id,seller_id,price_minor,currency,status) VALUES ($1,$2,$3,$4,2000,'INR','draft')", second, store, second_product, seller)
    repository = PostgresCatalogRepository(db_connection)
    owned = await repository.get_seller_listing(storefront_id=store, seller_id=seller, listing_id=listing)
    page = await repository.list_seller_listings(storefront_id=store, seller_id=seller, limit=1, offset=0)
    page_again = await repository.list_seller_listings(storefront_id=store, seller_id=seller, limit=1, offset=0)
    assert owned and owned["product_id"] == product and page == page_again


@pytest.mark.asyncio
async def test_scoped_repository_cross_storefront_and_seller_return_not_found(db_connection):
    seller, other_seller, _, store, other_store, _, listing = await _seed_catalog(db_connection)
    repository = PostgresCatalogRepository(db_connection)
    assert await repository.get_seller_listing(storefront_id=other_store, seller_id=seller, listing_id=listing) is None
    assert await repository.get_seller_listing(storefront_id=store, seller_id=other_seller, listing_id=listing) is None


@pytest.mark.asyncio
async def test_rejected_scoped_inventory_mutation_has_no_side_effect(db_connection):
    seller, other_seller, _, store, _, product, listing = await _seed_catalog(db_connection)
    repository = PostgresCatalogRepository(db_connection)
    before = await db_connection.fetchval("SELECT on_hand_quantity FROM inventory_balance WHERE product_id=$1", product)
    result = await repository.set_owned_inventory(storefront_id=store, seller_id=other_seller, listing_id=listing, quantity=99)
    after = await db_connection.fetchval("SELECT on_hand_quantity FROM inventory_balance WHERE product_id=$1", product)
    assert result is None and before == after == 10 and seller != other_seller


@pytest.mark.asyncio
async def test_owned_inventory_mutation_uses_compound_scope(db_connection):
    seller, _, _, store, _, product, listing = await _seed_catalog(db_connection)
    result = await PostgresCatalogRepository(db_connection).set_owned_inventory(
        storefront_id=store, seller_id=seller, listing_id=listing, quantity=0,
    )
    assert result and result["on_hand_quantity"] == 0 and result["available_quantity"] == 0
    assert result["product_id"] == product


@pytest.mark.asyncio
async def test_readiness_succeeds_for_reachable_current_schema(postgres_database):
    from shared.database.postgres import close_pool, get_pool, init_pool

    await init_pool()
    try:
        assert await check_readiness() is True
        assert get_pool().get_min_size() == 1 and get_pool().get_max_size() == 10
    finally:
        await close_pool()


@pytest.mark.asyncio
async def test_readiness_fails_safely_without_pool(monkeypatch):
    monkeypatch.setattr("database.engine.is_pool_ready", lambda: False)
    assert await check_readiness() is False


@pytest.mark.asyncio
async def test_readiness_response_exposes_no_connection_details(monkeypatch):
    async def unavailable():
        return False

    monkeypatch.setattr("database.engine.check_readiness", unavailable)
    async with AsyncClient(transport=ASGITransport(app=marketplace_app), base_url="https://api.zolexora.com") as client:
        response = await client.get("/api/ready")
    assert response.status_code == 503 and response.json() == {"status": "unavailable", "database": False, "redis": False}
    assert "postgresql" not in response.text and "marketplace-test-only" not in response.text


@pytest.mark.asyncio
async def test_liveness_is_independent_of_postgresql(monkeypatch):
    monkeypatch.setattr("shared.database.postgres.is_pool_ready", lambda: False)
    async with AsyncClient(transport=ASGITransport(app=marketplace_app), base_url="https://api.zolexora.com") as client:
        response = await client.get("/api/health")
    assert response.status_code == 200 and response.json()["status"] == "ok"


def test_no_active_oracle_runtime_dependency():
    requirements = (API / "requirements.txt").read_text().lower()
    active = "\n".join(path.read_text() for path in (API / "database").rglob("*.py"))
    assert "oracledb" not in requirements and "oracle+oracledb" not in active and "marketplace_oracle" not in active.lower()


def test_legacy_import_artifacts_are_offline(postgres_database):
    doc_path = ROOT / "project/docs/legacy-data-import-postgresql.md"
    if not doc_path.exists():
        doc_path = ROOT / "docs/legacy-data-import-postgresql.md"
    design = doc_path.read_text()
    assert "UNIMPLEMENTED" in design and "dry-run" in design and "MongoDB" in design and "Supabase" in design

