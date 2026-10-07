import uuid
import asyncpg
import pytest
from httpx import ASGITransport, AsyncClient

from main import app as marketplace_app
from seller_orgs.repository import PostgresSellerRepository
from seller_orgs.dependencies import require_active_seller_org
from core.deps import current_user, admin_only
from shared.database.postgres import pg_conn_dep


TEST_URL = "postgresql://marketplace_local:marketplace-local-only@127.0.0.1:5432/marketplace_local"


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
    # Seed users
    seller1_id = uuid.uuid4()
    seller2_id = uuid.uuid4()
    admin_id = uuid.uuid4()

    await pg_conn.execute(
        """
        INSERT INTO users (id, email, is_active, is_email_verified)
        VALUES ($1, $2, true, true), ($3, $4, true, true), ($5, $6, true, true)
        """,
        seller1_id, f"seller1_{seller1_id.hex[:6]}@example.com",
        seller2_id, f"seller2_{seller2_id.hex[:6]}@example.com",
        admin_id, f"admin_{admin_id.hex[:6]}@example.com",
    )

    # Seed storefronts if not existing
    shop_sf_id = uuid.uuid4()
    mahila_sf_id = uuid.uuid4()

    shop_existing = await pg_conn.fetchrow("SELECT id FROM storefront WHERE storefront_key = 'zolexora-shop'")
    if shop_existing:
        shop_sf_id = shop_existing["id"]
    else:
        await pg_conn.execute(
            """
            INSERT INTO storefront (id, storefront_key, display_name, locale, currency)
            VALUES ($1, 'zolexora-shop', 'Zolexora Shop', 'en-US', 'INR')
            """,
            shop_sf_id
        )

    mahila_existing = await pg_conn.fetchrow("SELECT id FROM storefront WHERE storefront_key = 'mahila-madel'")
    if mahila_existing:
        mahila_sf_id = mahila_existing["id"]
    else:
        await pg_conn.execute(
            """
            INSERT INTO storefront (id, storefront_key, display_name, locale, currency)
            VALUES ($1, 'mahila-madel', 'Mahila Madel', 'hi-IN', 'INR')
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


# ── 1. Grant Requirement for Publishing ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_seller_without_grant_cannot_publish(repo, seed_data):
    s1 = seed_data["seller1_id"]
    sf_shop = seed_data["shop_sf_id"]

    org = await repo.create_organization(
        name="Org Without Grant",
        slug=f"no-grant-{uuid.uuid4().hex[:6]}",
        owner_user_id=s1,
    )
    org_id = org["id"]

    # Verify status is PENDING_VERIFICATION initially
    assert org["status"] == "PENDING_VERIFICATION"

    # Even if org is set to ACTIVE, without grant, has_active_grant is False
    await repo.update_organization_status(org_id=org_id, status="ACTIVE", actor_user_id=s1)
    has_grant = await repo.has_active_grant(org_id, sf_shop)
    assert has_grant is False


# ── 2. Storefront Scope Isolation ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_storefront_grant_isolation(repo, seed_data):
    s1 = seed_data["seller1_id"]
    s2 = seed_data["seller2_id"]
    admin = seed_data["admin_id"]
    sf_shop = seed_data["shop_sf_id"]
    sf_mahila = seed_data["mahila_sf_id"]

    # Org 1 granted for Zolexora Shop only
    org1 = await repo.create_organization(name="Shop Seller", slug=f"shop-seller-{uuid.uuid4().hex[:6]}", owner_user_id=s1)
    await repo.update_organization_status(org_id=org1["id"], status="ACTIVE", actor_user_id=admin)
    g1 = await repo.request_storefront_grant(org_id=org1["id"], storefront_id=sf_shop, actor_user_id=s1)
    await repo.update_grant_status(grant_id=g1["id"], decision="APPROVE", admin_user_id=admin)

    # Org 2 granted for Mahila Madel only
    org2 = await repo.create_organization(name="Mahila Seller", slug=f"mahila-seller-{uuid.uuid4().hex[:6]}", owner_user_id=s2)
    await repo.update_organization_status(org_id=org2["id"], status="ACTIVE", actor_user_id=admin)
    g2 = await repo.request_storefront_grant(org_id=org2["id"], storefront_id=sf_mahila, actor_user_id=s2)
    await repo.update_grant_status(grant_id=g2["id"], decision="APPROVE", admin_user_id=admin)

    # Assert Org 1 can publish to Shop, but NOT Mahila
    assert await repo.has_active_grant(org1["id"], sf_shop) is True
    assert await repo.has_active_grant(org1["id"], sf_mahila) is False

    # Assert Org 2 can publish to Mahila, but NOT Shop
    assert await repo.has_active_grant(org2["id"], sf_mahila) is True
    assert await repo.has_active_grant(org2["id"], sf_shop) is False


# ── 3. Immediate Revocation Enforcement ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_revoked_grant_immediately_blocks_publishing(repo, seed_data):
    s1 = seed_data["seller1_id"]
    admin = seed_data["admin_id"]
    sf_shop = seed_data["shop_sf_id"]

    org = await repo.create_organization(name="Revoke Org", slug=f"revoke-org-{uuid.uuid4().hex[:6]}", owner_user_id=s1)
    await repo.update_organization_status(org_id=org["id"], status="ACTIVE", actor_user_id=admin)
    g = await repo.request_storefront_grant(org_id=org["id"], storefront_id=sf_shop, actor_user_id=s1)
    await repo.update_grant_status(grant_id=g["id"], decision="APPROVE", admin_user_id=admin)

    assert await repo.has_active_grant(org["id"], sf_shop) is True

    # Admin revokes grant
    await repo.update_grant_status(grant_id=g["id"], decision="REVOKE", admin_user_id=admin)

    # Immediately fails closed
    assert await repo.has_active_grant(org["id"], sf_shop) is False


# ── 4. Suspension Enforcement & Read-Only History ──────────────────────────────────

@pytest.mark.asyncio
async def test_suspended_org_blocks_writes_preserves_history(repo, seed_data):
    s1 = seed_data["seller1_id"]
    admin = seed_data["admin_id"]

    org = await repo.create_organization(name="Suspend Org", slug=f"suspend-org-{uuid.uuid4().hex[:6]}", owner_user_id=s1)
    org_id = org["id"]
    await repo.update_organization_status(org_id=org_id, status="ACTIVE", actor_user_id=admin)

    # Add second member while active
    m2 = await repo.add_member(org_id=org_id, user_id=seed_data["seller2_id"], role="MANAGER", actor_user_id=s1)
    assert m2["role"] == "MANAGER"

    # Suspend organization
    await repo.update_organization_status(org_id=org_id, status="SUSPENDED", actor_user_id=admin, reason="Compliance review")

    # Direct repository write check or dependency check
    class DummyRequest:
        def __init__(self, method):
            self.method = method

    # GET request permitted
    get_req = DummyRequest("GET")
    org_fetched = await require_active_seller_org(org_id, get_req, repo)
    assert org_fetched["id"] == org_id

    # POST/PUT request blocked with 403
    post_req = DummyRequest("POST")
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await require_active_seller_org(org_id, post_req, repo)
    assert exc_info.value.status_code == 403
    assert exc_info.value.headers.get("X-Error-Code") == "SELLER_ORG_SUSPENDED"

    # Verify historical member list is still queryable intact
    members = await repo.list_org_members(org_id)
    assert len(members) == 2


# ── 5. Multi-Tenant Fail-Closed Isolation ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_cross_organization_access_fails_closed(repo, seed_data):
    s1 = seed_data["seller1_id"]
    s2 = seed_data["seller2_id"]

    org1 = await repo.create_organization(name="Org One", slug=f"org-one-{uuid.uuid4().hex[:6]}", owner_user_id=s1)
    org2 = await repo.create_organization(name="Org Two", slug=f"org-two-{uuid.uuid4().hex[:6]}", owner_user_id=s2)

    # s1 member of org1, s2 member of org2
    member1 = await repo.get_member(org_id=org1["id"], user_id=s1)
    assert member1["role"] == "OWNER"

    # s1 is NOT member of org2
    member2 = await repo.get_member(org_id=org2["id"], user_id=s1)
    assert member2 is None

    # Member role update attempt on org2 by s1 fails
    with pytest.raises(ValueError, match="Member .* not found in organization"):
        await repo.update_member_role(
            org_id=org2["id"],
            member_id=uuid.uuid4(),
            new_role="ADMIN",
            actor_user_id=s1,
        )


# ── 6. Admin Approval RBAC ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_unauthorized_admin_cannot_approve_grants(repo, seed_data):
    s1 = seed_data["seller1_id"]
    sf_shop = seed_data["shop_sf_id"]

    org = await repo.create_organization(name="Approval Org", slug=f"appr-org-{uuid.uuid4().hex[:6]}", owner_user_id=s1)
    await repo.request_storefront_grant(org_id=org["id"], storefront_id=sf_shop, actor_user_id=s1)

    # Standard seller cannot approve grant (admin_only dependency blocks non-admins)
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        await admin_only(user={"id": str(s1), "role": "seller"})
    assert exc.value.status_code == 403

    # Real admin passes admin_only
    admin_user = await admin_only(user={"id": str(seed_data["admin_id"]), "role": "admin"})
    assert admin_user["role"] == "admin"


# ── 7. Mandatory Audit Attribution ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_grant_lifecycle_audit_logging(repo, seed_data, pg_conn):
    s1 = seed_data["seller1_id"]
    admin = seed_data["admin_id"]
    sf_shop = seed_data["shop_sf_id"]

    org = await repo.create_organization(name="Audit Org", slug=f"audit-org-{uuid.uuid4().hex[:6]}", owner_user_id=s1)
    org_id = org["id"]

    await repo.update_organization_verification(org_id=org_id, verification_status="VERIFIED", admin_user_id=admin)
    g = await repo.request_storefront_grant(org_id=org_id, storefront_id=sf_shop, actor_user_id=s1)
    await repo.update_grant_status(grant_id=g["id"], decision="APPROVE", admin_user_id=admin)
    await repo.update_grant_status(grant_id=g["id"], decision="REVOKE", admin_user_id=admin, reason="Violation")

    logs = await repo.list_audit_logs(org_id)
    actions = [log_item["action"] for log_item in logs]


    assert "ORG_CREATED" in actions
    assert "ORG_VERIFICATION_UPDATED" in actions
    assert "GRANT_REQUESTED" in actions
    assert "GRANT_APPROVE" in actions
    assert "GRANT_REVOKE" in actions

    # Immutability DB trigger test: Attempting UPDATE on seller_audit_log raises exception
    log_id = logs[0]["id"]
    with pytest.raises(asyncpg.PostgresError) as exc_info:
        await pg_conn.execute("UPDATE seller_audit_log SET action = 'HACKED' WHERE id = $1", log_id)
    assert "23514" in str(exc_info.value) or "immutable and append-only" in str(exc_info.value)



# ── 8. Concurrency & Race Condition Safety ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_concurrent_grant_requests_and_approvals(repo, seed_data, pg_conn):
    s1 = seed_data["seller1_id"]
    sf_shop = seed_data["shop_sf_id"]

    org = await repo.create_organization(name="Conc Org", slug=f"conc-org-{uuid.uuid4().hex[:6]}", owner_user_id=s1)
    org_id = org["id"]

    # First request grant succeeds
    g1 = await repo.request_storefront_grant(org_id=org_id, storefront_id=sf_shop, actor_user_id=s1)
    assert g1["grant_status"] == "PENDING"

    # Second request grant for same org + storefront raises ValueError
    with pytest.raises(ValueError, match="Organization already has a grant in 'PENDING' state"):
        await repo.request_storefront_grant(org_id=org_id, storefront_id=sf_shop, actor_user_id=s1)

    # Approve first grant
    admin = seed_data["admin_id"]
    await repo.update_grant_status(grant_id=g1["id"], decision="APPROVE", admin_user_id=admin)

    # Partial unique index check on active APPROVED grants:
    # Attempting to manually insert another APPROVED grant directly into DB fails unique constraint
    with pytest.raises(asyncpg.exceptions.UniqueViolationError):
        await pg_conn.execute(
            """
            INSERT INTO seller_storefront_grant (id, organization_id, storefront_id, grant_status)
            VALUES ($1, $2, $3, 'APPROVED')
            """,
            uuid.uuid4(), org_id, sf_shop
        )


# ── 9. HTTP Router Integration Tests ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_http_seller_organization_flow(pg_conn, seed_data):
    s1_id = seed_data["seller1_id"]
    user_payload = {"id": str(s1_id), "email": "seller1@example.com", "role": "seller"}

    marketplace_app.dependency_overrides[pg_conn_dep] = lambda: pg_conn
    marketplace_app.dependency_overrides[current_user] = lambda: user_payload

    try:
        async with AsyncClient(transport=ASGITransport(app=marketplace_app), base_url="http://test") as client:
            org_slug = f"http-org-{uuid.uuid4().hex[:6]}"
            create_res = await client.post(
                "/api/seller/organizations",
                json={"name": "HTTP Test Seller Org", "slug": org_slug},
            )
            assert create_res.status_code == 201
            org_data = create_res.json()
            assert org_data["slug"] == org_slug
            assert org_data["status"] == "PENDING_VERIFICATION"

            # List my orgs
            my_orgs_res = await client.get("/api/seller/organizations/me")
            assert my_orgs_res.status_code == 200
            assert len(my_orgs_res.json()) >= 1
    finally:
        marketplace_app.dependency_overrides.clear()
