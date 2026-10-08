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

ROOT = Path(__file__).parents[3]
API = ROOT / "services/marketplace-api"
COMPOSE = ROOT / "infrastructure/docker/postgres-test.compose.yml"
TEST_URL = "postgresql://marketplace_local:marketplace-local-only@127.0.0.1:5432/marketplace_local"


@dataclass(frozen=True)
class StepMigrationEvidence:
    at_0001: str
    at_0002: str
    at_0003: str
    first_head: tuple
    second_head: tuple


async def _reset_database() -> None:
    try:
        from shared.database.postgres import close_pool
        await close_pool()
    except Exception:
        pass

    connection = await asyncpg.connect(TEST_URL)
    try:
        await connection.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public")
    finally:
        await connection.close()


async def _insert_user(connection: asyncpg.Connection, user_id: uuid.UUID, email: str, name: str = "Test User") -> None:
    columns = [row["column_name"] for row in await connection.fetch(
        "SELECT column_name FROM information_schema.columns WHERE table_name='users'"
    )]
    if "name" in columns:
        await connection.execute(
            "INSERT INTO users (id, email, name) VALUES ($1, $2, $3)",
            user_id, email, name,
        )
    else:
        await connection.execute(
            "INSERT INTO users (id, email) VALUES ($1, $2)",
            user_id, email,
        )
        await connection.execute(
            "INSERT INTO user_profile (id, user_id, name) VALUES ($1, $1, $2) ON CONFLICT (user_id) DO NOTHING",
            user_id, name,
        )


async def _schema_fingerprint() -> tuple:
    connection = await asyncpg.connect(TEST_URL)
    try:
        tables = tuple(
            await connection.fetchval(
                "SELECT array_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname='public'"
            )
        )
        constraints = tuple(
            await connection.fetchval(
                "SELECT array_agg(conname ORDER BY conname) FROM pg_constraint WHERE connamespace='public'::regnamespace"
            )
        )
        indexes = tuple(
            await connection.fetchval(
                "SELECT array_agg(indexname ORDER BY indexname) FROM pg_indexes WHERE schemaname='public'"
            )
        )
        revision = await connection.fetchval("SELECT version_num FROM alembic_version")
        return tables, constraints, indexes, revision
    finally:
        await connection.close()


@pytest.fixture(scope="module")
def migration_step_database() -> StepMigrationEvidence:
    subprocess.run(["docker", "compose", "-f", str(COMPOSE), "up", "-d", "--wait"], check=True, cwd=ROOT)
    os.environ["DATABASE_URL"] = TEST_URL
    asyncio.run(_reset_database())
    config = Config(str(API / "alembic.ini"))

    # Step 1: Upgrade to 0001
    command.upgrade(config, "0001_postgresql_foundation")
    at_0001 = asyncio.run(_schema_fingerprint())[3]

    # Step 2: Upgrade to 0002
    command.upgrade(config, "0002_identity_session_rbac")
    at_0002 = asyncio.run(_schema_fingerprint())[3]

    # Step 3: Upgrade to 0003
    command.upgrade(config, "0003_persisted_storefront_domain_isolation")
    at_0003 = asyncio.run(_schema_fingerprint())[3]

    # Step 4: Upgrade to head (0004)
    command.upgrade(config, "head")
    first_head = asyncio.run(_schema_fingerprint())

    # Step 5: Re-upgrade to head
    command.upgrade(config, "head")
    second_head = asyncio.run(_schema_fingerprint())

    return StepMigrationEvidence(at_0001, at_0002, at_0003, first_head, second_head)




@pytest.fixture
async def db_connection(migration_step_database):
    connection = await asyncpg.connect(TEST_URL)
    transaction = connection.transaction()
    await transaction.start()
    try:
        yield connection
    finally:
        await transaction.rollback()
        await connection.close()


def test_stepwise_migration_chain_0001_0002_0003(migration_step_database):
    assert migration_step_database.at_0001 == "0001_postgresql_foundation"
    assert migration_step_database.at_0002 == "0002_identity_session_rbac"
    assert migration_step_database.at_0003 == "0003_persisted_storefront_domain_isolation"


def test_second_upgrade_to_head_is_noop(migration_step_database):
    assert migration_step_database.first_head == migration_step_database.second_head


def test_single_alembic_head_exists():
    config = Config(str(API / "alembic.ini"))
    heads = command.heads(config)
    assert heads is None


def test_empty_database_direct_upgrade_to_head():
    try:
        asyncio.run(_reset_database())
        config = Config(str(API / "alembic.ini"))
        command.upgrade(config, "head")
        fingerprint = asyncio.run(_schema_fingerprint())
        assert fingerprint[3] == "0010_erp_outbox_inbox"

    finally:
        asyncio.run(_reset_database())
        config = Config(str(API / "alembic.ini"))
        command.upgrade(config, "head")


@pytest.mark.asyncio
async def test_canonical_seed_records_exist(db_connection):
    storefronts = dict(
        await db_connection.fetch("SELECT storefront_key, id FROM storefront ORDER BY storefront_key")
    )
    assert uuid.UUID("60000000-0000-4000-4100-000000000001") == storefronts.get("zolexora-shop")
    assert uuid.UUID("60000000-0000-4000-4100-000000000002") == storefronts.get("mahila-madel")

    domains = await db_connection.fetch("SELECT hostname, storefront_id, environment, domain_role FROM storefront_domain ORDER BY hostname")
    domain_map = {row["hostname"]: row for row in domains}
    assert "shop.zolexora.com" in domain_map
    assert domain_map["shop.zolexora.com"]["storefront_id"] == uuid.UUID("60000000-0000-4000-4100-000000000001")
    assert "mahilamadel.store" in domain_map
    assert domain_map["mahilamadel.store"]["storefront_id"] == uuid.UUID("60000000-0000-4000-4100-000000000002")
    assert len(domain_map) == 5


@pytest.mark.asyncio
async def test_storefront_key_immutability_trigger(db_connection):
    with pytest.raises(asyncpg.CheckViolationError):
        async with db_connection.transaction():
            await db_connection.execute(
                "UPDATE storefront SET storefront_key = 'hacked-key' WHERE storefront_key = 'zolexora-shop'"
            )


@pytest.mark.asyncio
async def test_storefront_domain_storefront_id_immutability_trigger(db_connection):
    with pytest.raises(asyncpg.CheckViolationError):
        async with db_connection.transaction():
            await db_connection.execute(
                "UPDATE storefront_domain SET storefront_id = '60000000-0000-4000-4100-000000000002' WHERE hostname = 'shop.zolexora.com'"
            )


@pytest.mark.asyncio
async def test_order_storefront_id_immutability_trigger(db_connection):
    seller_id = uuid.uuid4()
    buyer_id = uuid.uuid4()
    order_id = uuid.uuid4()
    storefront_id = uuid.UUID("60000000-0000-4000-4100-000000000001")
    other_storefront_id = uuid.UUID("60000000-0000-4000-4100-000000000002")

    await _insert_user(db_connection, buyer_id, "buyer-test@example.com", "Buyer Test")
    await _insert_user(db_connection, seller_id, "seller-test@example.com", "Seller Test")

    await db_connection.execute(
        """
        INSERT INTO marketplace_order (
            id, storefront_id, buyer_id, seller_id, public_order_number,
            currency, subtotal_minor, total_minor, status, address_snapshot
        ) VALUES ($1, $2, $3, $4, 'ORD-TEST-001', 'INR', 1000, 1000, 'placed', '{}')
        """,
        order_id, storefront_id, buyer_id, seller_id,
    )

    with pytest.raises(asyncpg.CheckViolationError):
        async with db_connection.transaction():
            await db_connection.execute(
                "UPDATE marketplace_order SET storefront_id = $1 WHERE id = $2",
                other_storefront_id, order_id,
            )


@pytest.mark.asyncio
async def test_cart_storefront_id_immutability_trigger(db_connection):
    buyer_id = uuid.uuid4()
    cart_id = uuid.uuid4()
    storefront_id = uuid.UUID("60000000-0000-4000-4100-000000000001")
    other_storefront_id = uuid.UUID("60000000-0000-4000-4100-000000000002")

    await _insert_user(db_connection, buyer_id, "buyer-cart-test@example.com", "Buyer Cart Test")
    await db_connection.execute(
        "INSERT INTO cart (id, storefront_id, buyer_id, currency) VALUES ($1, $2, $3, 'INR')",
        cart_id, storefront_id, buyer_id,
    )

    with pytest.raises(asyncpg.CheckViolationError):
        async with db_connection.transaction():
            await db_connection.execute(
                "UPDATE cart SET storefront_id = $1 WHERE id = $2",
                other_storefront_id, cart_id,
            )


@pytest.mark.asyncio
async def test_normalized_hostname_uniqueness_and_lower_constraint(db_connection):
    storefront_id = uuid.UUID("60000000-0000-4000-4100-000000000001")
    # Uppercase hostname is rejected by check constraint ck_storefront_domain_storefront_domain_hostname_lower
    with pytest.raises(asyncpg.CheckViolationError):
        async with db_connection.transaction():
            await db_connection.execute(
                """
                INSERT INTO storefront_domain (id, storefront_id, hostname, environment, domain_role)
                VALUES ($1, $2, 'SHOP.ZOLEXORA.COM', 'production', 'alias')
                """,
                uuid.uuid4(), storefront_id,
            )

    # Duplicate hostname is rejected by uq_storefront_domain_hostname
    with pytest.raises(asyncpg.UniqueViolationError):
        async with db_connection.transaction():
            await db_connection.execute(
                """
                INSERT INTO storefront_domain (id, storefront_id, hostname, environment, domain_role)
                VALUES ($1, $2, 'shop.zolexora.com', 'production', 'alias')
                """,
                uuid.uuid4(), storefront_id,
            )


@pytest.mark.asyncio
async def test_surface_domain_rejection_check_constraint(db_connection):
    storefront_id = uuid.UUID("60000000-0000-4000-4100-000000000001")
    for surface_domain in ("api.zolexora.com", "seller.zolexora.com", "admin.marketplace.zolexora.com"):
        with pytest.raises(asyncpg.CheckViolationError):
            async with db_connection.transaction():
                await db_connection.execute(
                    """
                    INSERT INTO storefront_domain (id, storefront_id, hostname, environment, domain_role)
                    VALUES ($1, $2, $3, 'production', 'alias')
                    """,
                    uuid.uuid4(), storefront_id, surface_domain,
                )


@pytest.mark.asyncio
async def test_trailing_dot_domain_check_constraint(db_connection):
    storefront_id = uuid.UUID("60000000-0000-4000-4100-000000000001")
    with pytest.raises(asyncpg.CheckViolationError):
        async with db_connection.transaction():
            await db_connection.execute(
                """
                INSERT INTO storefront_domain (id, storefront_id, hostname, environment, domain_role)
                VALUES ($1, $2, 'shop.zolexora.com.', 'production', 'alias')
                """,
                uuid.uuid4(), storefront_id,
            )


def test_downgrade_raises_runtime_error():
    config = Config(str(API / "alembic.ini"))
    with pytest.raises(RuntimeError, match="Forward-only migrations do not support downgrade"):
        command.downgrade(config, "-1")
