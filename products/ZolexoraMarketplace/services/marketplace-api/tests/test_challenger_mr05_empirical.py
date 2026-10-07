import asyncio
import uuid
import asyncpg
import pytest
from httpx import ASGITransport, AsyncClient
from fastapi import APIRouter, Depends

from main import app as marketplace_app
from seller_orgs.repository import PostgresSellerRepository
from seller_orgs.dependencies import require_storefront_grant, require_active_seller_org
from core.deps import current_user
from shared.database.postgres import pg_conn_dep
from storefronts.dependencies import storefront_repository
from storefronts.models import StorefrontDefinition, StorefrontKey

TEST_URL = "postgresql://marketplace_local:marketplace-local-only@127.0.0.1:5432/marketplace_local"

# Dummy test router simulating a storefront publishing route guarded by require_storefront_grant
test_publish_router = APIRouter()

@test_publish_router.post("/api/test/publish/{org_id}")
async def publish_product_test_endpoint(
    org_id: uuid.UUID,
    _org: dict = Depends(require_active_seller_org),
    storefront_id: uuid.UUID = Depends(require_storefront_grant),
):
    return {"status": "published", "org_id": str(org_id), "storefront_id": str(storefront_id)}

marketplace_app.include_router(test_publish_router)


class MockStorefrontRepository:
    def __init__(self, shop_sf_id: uuid.UUID, mahila_sf_id: uuid.UUID):
        self.development = True
        self.shop_def = StorefrontDefinition(
            id=str(shop_sf_id),
            key=StorefrontKey.ZOLEXORA_SHOP,
            display_name="Zolexora Shop",
            canonical_host="shop.zolexora.com",
            hosts=frozenset({"shop.zolexora.com"}),
            origins=frozenset({"https://shop.zolexora.com"}),
        )
        self.mahila_def = StorefrontDefinition(
            id=str(mahila_sf_id),
            key=StorefrontKey.MAHILA_MADEL,
            display_name="Mahila Madel",
            canonical_host="mahilamadel.store",
            hosts=frozenset({"mahilamadel.store"}),
            origins=frozenset({"https://mahilamadel.store"}),
        )

    async def get_definition_by_host(self, host: str):
        if host == "shop.zolexora.com":
            return self.shop_def
        if host == "mahilamadel.store":
            return self.mahila_def
        return None

    async def get_surface_by_host(self, host: str):
        return None

    async def get_definition_by_origin(self, origin: str):
        return None

    async def get_definition_by_key(self, key):
        if key == StorefrontKey.ZOLEXORA_SHOP or str(key) == "zolexora-shop":
            return self.shop_def
        if key == StorefrontKey.MAHILA_MADEL or str(key) == "mahila-madel":
            return self.mahila_def
        return None


@pytest.fixture
async def pg_conn():
    import os
    import subprocess
    try:
        conn = await asyncpg.connect(TEST_URL)
        rev = await conn.fetchval("SELECT version_num FROM alembic_version")
        if rev != "0010_erp_outbox_inbox":
            raise ValueError("Database not at head revision")
    except Exception:
        subprocess.run(
            ["docker", "compose", "-f", "infrastructure/docker/postgres-test.compose.yml", "up", "-d", "--wait"],
            cwd="../..",
            check=True,
        )
        subprocess.run(
            ["alembic", "upgrade", "head"],
            cwd=".",
            env={**os.environ, "DATABASE_URL": "postgresql+asyncpg://marketplace_local:marketplace-local-only@127.0.0.1:5432/marketplace_local"},
            check=True,
        )
        conn = await asyncpg.connect(TEST_URL)

    transaction = conn.transaction()
    await transaction.start()
    try:
        yield conn
    finally:
        await transaction.rollback()
        await conn.close()


@pytest.fixture
async def repo(pg_conn):
    return PostgresSellerRepository(pg_conn)


@pytest.fixture
async def seed_data(pg_conn):
    seller1_id = uuid.uuid4()
    seller2_id = uuid.uuid4()
    admin_id = uuid.uuid4()

    await pg_conn.execute(
        """
        INSERT INTO users (id, email, is_active, is_email_verified)
        VALUES ($1, $2, true, true), ($3, $4, true, true), ($5, $6, true, true)
        """,
        seller1_id, f"challenger_s1_{seller1_id.hex[:6]}@example.com",
        seller2_id, f"challenger_s2_{seller2_id.hex[:6]}@example.com",
        admin_id, f"challenger_admin_{admin_id.hex[:6]}@example.com",
    )

    shop_sf_id = uuid.uuid4()
    mahila_sf_id = uuid.uuid4()

    shop_existing = await pg_conn.fetchrow("SELECT id FROM storefront WHERE storefront_key = 'zolexora-shop'")
    if shop_existing:
        shop_sf_id = shop_existing["id"]
    else:
        await pg_conn.execute(
            """
            INSERT INTO storefront (id, storefront_key, display_name, is_active, currency, locale)
            VALUES ($1, 'zolexora-shop', 'Zolexora Shop', true, 'INR', 'en-IN')
            """,
            shop_sf_id
        )

    mahila_existing = await pg_conn.fetchrow("SELECT id FROM storefront WHERE storefront_key = 'mahila-madel'")
    if mahila_existing:
        mahila_sf_id = mahila_existing["id"]
    else:
        await pg_conn.execute(
            """
            INSERT INTO storefront (id, storefront_key, display_name, is_active, currency, locale)
            VALUES ($1, 'mahila-madel', 'Mahila Madel', true, 'INR', 'hi-IN')
            """,
            mahila_sf_id
        )

    return {
        "seller1_id": seller1_id,
        "seller2_id": seller2_id,
        "admin_id": admin_id,
        "shop_sf_id": shop_sf_id,
        "mahila_sf_id": mahila_sf_id,
    }


# ── Task Requirement 1: Zero Grants Publishing Attempt Returns 403 ───────────────────

@pytest.mark.asyncio
async def test_zero_grants_publishing_attempt_returns_403(pg_conn, repo, seed_data):
    """
    Test publishing attempt with zero grants -> must return 403.
    """
    s1_id = seed_data["seller1_id"]
    admin_id = seed_data["admin_id"]
    shop_sf_id = seed_data["shop_sf_id"]
    mahila_sf_id = seed_data["mahila_sf_id"]

    org = await repo.create_organization(
        name="Zero Grants Org",
        slug=f"zero-grant-{uuid.uuid4().hex[:6]}",
        owner_user_id=s1_id,
    )
    org_id = org["id"]
    await repo.update_organization_status(org_id=org_id, status="ACTIVE", actor_user_id=admin_id)

    user_payload = {"id": str(s1_id), "email": "seller1@example.com", "role": "seller"}
    mock_sf_repo = MockStorefrontRepository(shop_sf_id, mahila_sf_id)

    marketplace_app.dependency_overrides[pg_conn_dep] = lambda: pg_conn
    marketplace_app.dependency_overrides[current_user] = lambda: user_payload
    marketplace_app.dependency_overrides[storefront_repository] = lambda: mock_sf_repo

    try:
        async with AsyncClient(transport=ASGITransport(app=marketplace_app), base_url="http://test") as client:
            res = await client.post(
                f"/api/test/publish/{org_id}",
                headers={"Host": "shop.zolexora.com"},
            )
            assert res.status_code == 403, f"Expected 403 Forbidden, got {res.status_code}: {res.text}"
            res_json = res.json()
            assert res_json["detail"] is not None
            assert res.headers.get("X-Error-Code") == "STOREFRONT_GRANT_REQUIRED"
    finally:
        marketplace_app.dependency_overrides.clear()


# ── Task Requirement 2: Storefront Grant Isolation (Zolexora -> Mahila 403) ────────

@pytest.mark.asyncio
async def test_zolexora_granted_seller_cannot_publish_to_mahila_madel(pg_conn, repo, seed_data):
    """
    Test Zolexora-granted seller attempting publish to Mahila Madel -> must return 403.
    Must return 200 when publishing to Zolexora Shop.
    """
    s1_id = seed_data["seller1_id"]
    admin_id = seed_data["admin_id"]
    shop_sf_id = seed_data["shop_sf_id"]
    mahila_sf_id = seed_data["mahila_sf_id"]

    org = await repo.create_organization(
        name="Shop Granted Org",
        slug=f"shop-only-{uuid.uuid4().hex[:6]}",
        owner_user_id=s1_id,
    )
    org_id = org["id"]
    await repo.update_organization_status(org_id=org_id, status="ACTIVE", actor_user_id=admin_id)

    # Request & approve grant for Zolexora Shop ONLY
    g = await repo.request_storefront_grant(org_id=org_id, storefront_id=shop_sf_id, actor_user_id=s1_id)
    await repo.update_grant_status(grant_id=g["id"], decision="APPROVE", admin_user_id=admin_id)

    user_payload = {"id": str(s1_id), "email": "seller1@example.com", "role": "seller"}
    mock_sf_repo = MockStorefrontRepository(shop_sf_id, mahila_sf_id)

    marketplace_app.dependency_overrides[pg_conn_dep] = lambda: pg_conn
    marketplace_app.dependency_overrides[current_user] = lambda: user_payload
    marketplace_app.dependency_overrides[storefront_repository] = lambda: mock_sf_repo

    try:
        async with AsyncClient(transport=ASGITransport(app=marketplace_app), base_url="http://test") as client:
            # 1. Attempt publishing to Zolexora Shop (Host: shop.zolexora.com) -> MUST SUCCEED (200)
            shop_res = await client.post(
                f"/api/test/publish/{org_id}",
                headers={"Host": "shop.zolexora.com"},
            )
            assert shop_res.status_code == 200, f"Expected 200 OK for granted storefront, got {shop_res.status_code}: {shop_res.text}"
            assert shop_res.json()["status"] == "published"

            # 2. Attempt publishing to Mahila Madel (Host: mahilamadel.store) -> MUST RETURN 403 Forbidden
            mahila_res = await client.post(
                f"/api/test/publish/{org_id}",
                headers={"Host": "mahilamadel.store"},
            )
            assert mahila_res.status_code == 403, f"Expected 403 Forbidden for cross-storefront publish, got {mahila_res.status_code}: {mahila_res.text}"
            assert mahila_res.headers.get("X-Error-Code") == "STOREFRONT_GRANT_REQUIRED"
    finally:
        marketplace_app.dependency_overrides.clear()


# ── Task Requirement 3: Immediate Revocation Enforcement ────────────────────────────

@pytest.mark.asyncio
async def test_revoked_grant_immediately_blocks_publishing(pg_conn, repo, seed_data):
    """
    Test revoked grant -> must immediately block publishing.
    """
    s1_id = seed_data["seller1_id"]
    admin_id = seed_data["admin_id"]
    shop_sf_id = seed_data["shop_sf_id"]
    mahila_sf_id = seed_data["mahila_sf_id"]

    org = await repo.create_organization(
        name="Revocation Org",
        slug=f"revoc-{uuid.uuid4().hex[:6]}",
        owner_user_id=s1_id,
    )
    org_id = org["id"]
    await repo.update_organization_status(org_id=org_id, status="ACTIVE", actor_user_id=admin_id)

    # Approve grant
    g = await repo.request_storefront_grant(org_id=org_id, storefront_id=shop_sf_id, actor_user_id=s1_id)
    grant_id = g["id"]
    await repo.update_grant_status(grant_id=grant_id, decision="APPROVE", admin_user_id=admin_id)

    user_payload = {"id": str(s1_id), "email": "seller1@example.com", "role": "seller"}
    admin_payload = {"id": str(admin_id), "email": "admin@example.com", "role": "admin"}
    mock_sf_repo = MockStorefrontRepository(shop_sf_id, mahila_sf_id)

    marketplace_app.dependency_overrides[pg_conn_dep] = lambda: pg_conn
    marketplace_app.dependency_overrides[current_user] = lambda: user_payload
    marketplace_app.dependency_overrides[storefront_repository] = lambda: mock_sf_repo

    try:
        async with AsyncClient(transport=ASGITransport(app=marketplace_app), base_url="http://test") as client:
            # Verify publishing works before revocation
            before_res = await client.post(
                f"/api/test/publish/{org_id}",
                headers={"Host": "shop.zolexora.com"},
            )
            assert before_res.status_code == 200

            # Admin revokes grant via API router endpoint
            marketplace_app.dependency_overrides[current_user] = lambda: admin_payload
            revoke_res = await client.put(
                f"/api/admin/storefront-grants/{grant_id}/decision",
                json={"decision": "REVOKE", "reason": "Policy violation"},
            )
            assert revoke_res.status_code == 200, f"Revoke failed: {revoke_res.text}"
            assert revoke_res.json()["grant_status"] == "REVOKED"

            # Switch back to seller & attempt publish immediately
            marketplace_app.dependency_overrides[current_user] = lambda: user_payload
            after_res = await client.post(
                f"/api/test/publish/{org_id}",
                headers={"Host": "shop.zolexora.com"},
            )
            assert after_res.status_code == 403, f"Expected 403 Forbidden after grant revocation, got {after_res.status_code}: {after_res.text}"
            assert after_res.headers.get("X-Error-Code") == "STOREFRONT_GRANT_REQUIRED"
    finally:
        marketplace_app.dependency_overrides.clear()


# ── Task Requirement 4: Concurrency & Partial Unique Index Tests ────────────────────

@pytest.mark.asyncio
async def test_concurrent_duplicate_grant_applications_handled_safely():
    """
    Test race conditions: concurrent duplicate grant applications.
    10 separate DB connections concurrently request a grant for the same (org_id, storefront_id).
    Exactly 1 connection succeeds and 9 fail with ValueError / duplicate grant error without deadlocks.
    """
    conn_setup = await asyncpg.connect(TEST_URL)
    user_id = uuid.uuid4()
    org_id = uuid.uuid4()
    sf_id = uuid.uuid4()

    try:
        # Commit user, org, and storefront so all independent connections can see them
        await conn_setup.execute(
            "INSERT INTO users (id, email, is_active, is_email_verified) VALUES ($1, $2, true, true)",
            user_id, f"conc_user_{user_id.hex[:6]}@example.com"
        )
        await conn_setup.execute(
            "INSERT INTO storefront (id, storefront_key, display_name, is_active, currency, locale) VALUES ($1, $2, 'Test SF', true, 'INR', 'en-IN')",
            sf_id, f"sf-key-{sf_id.hex[:6]}"
        )
        await conn_setup.execute(
            "INSERT INTO seller_organization (id, name, slug, status) VALUES ($1, 'Conc Org', $2, 'ACTIVE')",
            org_id, f"slug-{org_id.hex[:6]}"
        )
        await conn_setup.execute(
            "INSERT INTO seller_org_member (id, organization_id, user_id, role, status) VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')",
            uuid.uuid4(), org_id, user_id
        )

        connections = [await asyncpg.connect(TEST_URL) for _ in range(10)]

        async def request_grant(conn):
            repo_instance = PostgresSellerRepository(conn)
            try:
                return await repo_instance.request_storefront_grant(
                    org_id=org_id,
                    storefront_id=sf_id,
                    actor_user_id=user_id,
                    grant_reason="Concurrent test",
                )
            except ValueError as e:
                return e

        results = await asyncio.gather(*[request_grant(c) for c in connections], return_exceptions=True)

        for c in connections:
            await c.close()

        successes = [r for r in results if isinstance(r, dict)]
        failures = [r for r in results if isinstance(r, ValueError)]

        assert len(successes) == 1, f"Expected exactly 1 successful grant request, got {len(successes)}"
        assert len(failures) == 9, f"Expected 9 failures due to existing PENDING grant, got {len(failures)}"

    finally:
        await conn_setup.execute("SET session_replication_role = 'replica'")
        await conn_setup.execute("DELETE FROM seller_audit_log WHERE organization_id = $1", org_id)
        await conn_setup.execute("DELETE FROM seller_storefront_grant WHERE organization_id = $1", org_id)
        await conn_setup.execute("DELETE FROM seller_organization WHERE id = $1", org_id)
        await conn_setup.execute("DELETE FROM storefront WHERE id = $1", sf_id)
        await conn_setup.execute("DELETE FROM users WHERE id = $1", user_id)
        await conn_setup.execute("SET session_replication_role = 'origin'")
        await conn_setup.close()


@pytest.mark.asyncio
async def test_concurrent_active_grants_enforced_by_partial_unique_index():
    """
    Test race conditions: concurrent duplicate grant approvals or active grant creation.
    The partial unique index `uq_seller_storefront_grant_active` on (organization_id, storefront_id) WHERE grant_status = 'APPROVED'
    must prevent duplicate active grants across concurrent transactions without deadlocks.
    """
    conn_setup = await asyncpg.connect(TEST_URL)
    org_id = uuid.uuid4()
    sf_id = uuid.uuid4()

    try:
        await conn_setup.execute(
            "INSERT INTO storefront (id, storefront_key, display_name, is_active, currency, locale) VALUES ($1, $2, 'Unique SF', true, 'INR', 'en-IN')",
            sf_id, f"sf-idx-{sf_id.hex[:6]}"
        )
        await conn_setup.execute(
            "INSERT INTO seller_organization (id, name, slug, status) VALUES ($1, 'Unique Idx Org', $2, 'ACTIVE')",
            org_id, f"slug-idx-{org_id.hex[:6]}"
        )

        conn1 = await asyncpg.connect(TEST_URL)
        conn2 = await asyncpg.connect(TEST_URL)

        g1_id = uuid.uuid4()
        g2_id = uuid.uuid4()

        async def insert_approved(conn, grant_id):
            try:
                await conn.execute(
                    """
                    INSERT INTO seller_storefront_grant (id, organization_id, storefront_id, grant_status)
                    VALUES ($1, $2, $3, 'APPROVED')
                    """,
                    grant_id, org_id, sf_id
                )
                return "SUCCESS"
            except asyncpg.exceptions.UniqueViolationError as e:
                return e

        res1, res2 = await asyncio.gather(
            insert_approved(conn1, g1_id),
            insert_approved(conn2, g2_id),
            return_exceptions=True,
        )

        await conn1.close()
        await conn2.close()

        statuses = [res1, res2]
        success_count = sum(1 for s in statuses if s == "SUCCESS")
        unique_violations = sum(1 for s in statuses if isinstance(s, asyncpg.exceptions.UniqueViolationError))

        assert success_count == 1, f"Expected exactly 1 successful insert of APPROVED grant, got {success_count}"
        assert unique_violations == 1, f"Expected exactly 1 UniqueViolationError from uq_seller_storefront_grant_active, got {unique_violations}"

    finally:
        await conn_setup.execute("DELETE FROM seller_storefront_grant WHERE organization_id = $1", org_id)
        await conn_setup.execute("DELETE FROM seller_organization WHERE id = $1", org_id)
        await conn_setup.execute("DELETE FROM storefront WHERE id = $1", sf_id)
        await conn_setup.close()
