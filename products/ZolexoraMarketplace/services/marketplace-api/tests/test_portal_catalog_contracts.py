import json
import uuid
from datetime import datetime, timezone

import asyncpg
import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from core.deps import current_user
from shared.database.postgres import pg_conn_dep
from main import app
from models.portal_catalog import (
    MAX_INVENTORY_QUANTITY,
    AdminListingModerationRequest,
    SellerInventoryUpdate,
    SellerListingCreate,
    SellerListingLifecycleRequest,
    SellerListingUpdate,
)
from routers.portal_catalog import (
    change_seller_listing_lifecycle,
    create_seller_listing,
    get_admin_inventory,
    get_admin_listing,
    get_seller_inventory,
    get_seller_listing,
    list_admin_listings,
    list_seller_listings,
    moderate_admin_listing,
    update_seller_inventory,
    update_seller_listing,
)
from storefronts.models import StorefrontContext, StorefrontContextSource, StorefrontDefinition, StorefrontKey


NOW = datetime(2026, 8, 1, 12, 0, tzinfo=timezone.utc)
SELLER = {"id": str(uuid.uuid4()), "name": "Seller One", "role": "seller"}
OTHER_SELLER = {"id": str(uuid.uuid4()), "name": "Seller Two", "role": "seller"}
ADMIN = {"id": str(uuid.uuid4()), "name": "Admin One", "role": "admin"}

SF_SHOP_ID = "60000000-0000-4000-4100-000000000001"
SF_MAHILA_ID = "60000000-0000-4000-4100-000000000002"
ORG_SELLER_ID = str(uuid.uuid4())
ORG_OTHER_SELLER_ID = str(uuid.uuid4())


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

def context(key: StorefrontKey = StorefrontKey.ZOLEXORA_SHOP) -> StorefrontContext:
    return StorefrontContext(
        storefront=StorefrontDefinition(
            id=f"sf-{key.value}",
            key=key,
            display_name=key.value,
            canonical_host="shop.zolexora.com" if key == StorefrontKey.ZOLEXORA_SHOP else "mahilamadel.store",
            hosts=frozenset(),
            origins=frozenset(),
            currency="INR",
            locale="en-IN",
            enabled=True,
        ),
        source=StorefrontContextSource.HOST,
    )


async def setup_base_data(conn: asyncpg.Connection):
    await conn.execute("INSERT INTO storefront (id, storefront_key, display_name, currency, locale) VALUES ($1, 'zolexora-shop', 'Zolexora Shop', 'INR', 'en-IN') ON CONFLICT DO NOTHING", uuid.UUID(SF_SHOP_ID))
    await conn.execute("INSERT INTO storefront (id, storefront_key, display_name, currency, locale) VALUES ($1, 'mahila-madel', 'Mahila Madel', 'INR', 'en-IN') ON CONFLICT DO NOTHING", uuid.UUID(SF_MAHILA_ID))
    
    for u in [SELLER, OTHER_SELLER, ADMIN]:
        await conn.execute("INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING", uuid.UUID(u["id"]), f"{u['id']}@example.com")
    
    await conn.execute("INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING", uuid.UUID(ORG_SELLER_ID), "org_seller@example.com")
    await conn.execute("INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING", uuid.UUID(ORG_OTHER_SELLER_ID), "org_other@example.com")

        
    await conn.execute("INSERT INTO seller_organization (id, name, slug, status) VALUES ($1, $2, $3, 'ACTIVE') ON CONFLICT DO NOTHING", uuid.UUID(ORG_SELLER_ID), SELLER["name"], "seller-one-slug")
    await conn.execute("INSERT INTO seller_org_member (id, organization_id, user_id, role, status) VALUES ($1, $2, $3, 'OWNER', 'ACTIVE') ON CONFLICT DO NOTHING", uuid.uuid4(), uuid.UUID(ORG_SELLER_ID), uuid.UUID(SELLER["id"]))

    await conn.execute("INSERT INTO seller_organization (id, name, slug, status) VALUES ($1, $2, $3, 'ACTIVE') ON CONFLICT DO NOTHING", uuid.UUID(ORG_OTHER_SELLER_ID), OTHER_SELLER["name"], "seller-two-slug")
    await conn.execute("INSERT INTO seller_org_member (id, organization_id, user_id, role, status) VALUES ($1, $2, $3, 'OWNER', 'ACTIVE') ON CONFLICT DO NOTHING", uuid.uuid4(), uuid.UUID(ORG_OTHER_SELLER_ID), uuid.UUID(OTHER_SELLER["id"]))

async def seed_product(conn: asyncpg.Connection, product_id: str, seller_user: dict, active: bool = True):
    org_id = ORG_SELLER_ID if seller_user["id"] == SELLER["id"] else ORG_OTHER_SELLER_ID
    await conn.execute(
        "INSERT INTO master_product (id, organization_id, slug, name, description, lifecycle_status) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING",
        uuid.UUID(product_id), uuid.UUID(org_id), f"prod-{product_id}", f"Product {product_id}", "Canonical product description", "ACTIVE" if active else "DRAFT"
    )
    await conn.execute(
        "INSERT INTO product (id, seller_id, title, description, category, is_active) VALUES ($1, $2, $3, $4, 'test-cat', true) ON CONFLICT DO NOTHING",
        uuid.UUID(product_id), uuid.UUID(org_id), f"Product {product_id}", "Canonical product description"
    )
    await conn.execute(
        "INSERT INTO inventory_balance (id, product_id, seller_id, on_hand_quantity, reserved_quantity, updated_at) VALUES ($1, $2, $3, 10, 2, $4) ON CONFLICT DO NOTHING",
        uuid.uuid4(), uuid.UUID(product_id), uuid.UUID(org_id), NOW
    )

async def seed_listing(
    conn: asyncpg.Connection,
    listing_id: str,
    product_id: str = "00000000-0000-0000-0000-000000000100",
    seller_user: dict = SELLER,
    storefront: StorefrontKey = StorefrontKey.ZOLEXORA_SHOP,
    status: str = "draft",
    created_at=NOW,
):
    org_id = ORG_SELLER_ID if seller_user["id"] == SELLER["id"] else ORG_OTHER_SELLER_ID
    sf_id = SF_SHOP_ID if storefront == StorefrontKey.ZOLEXORA_SHOP else SF_MAHILA_ID
    
    await seed_product(conn, product_id, seller_user)
    
    db_state = "DRAFT"
    if status == "active": db_state = "PUBLISHED"
    elif status == "paused": db_state = "HIDDEN"
    elif status in ("rejected", "archived"): db_state = "SUSPENDED"

    content = {
        "price": {"amount_minor": 1500, "currency": "INR"},
        "status": status,
    }
    
    await conn.execute(
        "INSERT INTO storefront_listing (id, storefront_id, organization_id, product_id, publication_state, listing_content, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING",
        uuid.UUID(listing_id), uuid.UUID(sf_id), uuid.UUID(org_id), uuid.UUID(product_id), db_state, json.dumps(content), created_at, created_at
    )

@pytest.mark.parametrize("quantity", [True, 1.5, "1", -1, MAX_INVENTORY_QUANTITY + 1])
def test_inventory_quantity_is_strict_and_bounded(quantity):
    with pytest.raises(ValidationError):
        SellerInventoryUpdate(quantity=quantity)


def test_inventory_quantity_zero_is_valid():
    assert SellerInventoryUpdate(quantity=0).quantity == 0


@pytest.mark.parametrize("field", ["seller_id", "storefront_id", "status", "admin_role", "reserved_quantity"])
def test_seller_public_models_reject_identity_and_control_overrides(field):
    payload = {"product_id": "00000000-0000-0000-0000-000000000100", "price": {"amount_minor": 100, "currency": "INR"}, field: "forged"}
    with pytest.raises(ValidationError):
        SellerListingCreate(**payload)

@pytest.mark.asyncio
async def test_seller_creates_draft_listing_for_owned_eligible_product_only(pg_conn):
    await setup_base_data(pg_conn)
    prod_id = "00000000-0000-0000-0000-000000000100"
    await seed_product(pg_conn, prod_id, SELLER)
    response = await create_seller_listing(
        SellerListingCreate(product_id=prod_id, price={"amount_minor": 1_500, "currency": "INR"}),
        context=context(),
        user=SELLER,
        db=pg_conn,
    )
    assert response.status == "draft"
    assert response.seller_id == ORG_SELLER_ID
    assert response.storefront_id == StorefrontKey.ZOLEXORA_SHOP
    
    count = await pg_conn.fetchval("SELECT count(*) FROM storefront_listing")
    assert count == 1

    prod2 = "00000000-0000-0000-0000-000000000101"
    await seed_product(pg_conn, prod2, OTHER_SELLER)
    with pytest.raises(HTTPException) as error:
        await create_seller_listing(
            SellerListingCreate(product_id=prod2, price={"amount_minor": 1_500, "currency": "INR"}),
            context=context(),
            user=SELLER,
            db=pg_conn,
        )
    assert error.value.status_code == 404
    assert await pg_conn.fetchval("SELECT count(*) FROM storefront_listing") == 1


@pytest.mark.asyncio
async def test_seller_list_and_read_are_owner_storefront_scoped_and_ordered(pg_conn):
    await setup_base_data(pg_conn)
    L_OLDER = "00000000-0000-0000-0000-000000000201"
    L_NEWER = "00000000-0000-0000-0000-000000000202"
    L_OTHER_SELLER = "00000000-0000-0000-0000-000000000203"
    L_OTHER_STORE = "00000000-0000-0000-0000-000000000204"
    
    await seed_listing(pg_conn, listing_id=L_OLDER, created_at=datetime(2026, 8, 1, 10, 0, tzinfo=timezone.utc))
    await seed_listing(pg_conn, listing_id=L_NEWER, product_id="00000000-0000-0000-0000-000000000102", created_at=NOW)
    await seed_listing(pg_conn, listing_id=L_OTHER_SELLER, product_id="00000000-0000-0000-0000-000000000103", seller_user=OTHER_SELLER)
    await seed_listing(pg_conn, listing_id=L_OTHER_STORE, product_id="00000000-0000-0000-0000-000000000104", storefront=StorefrontKey.MAHILA_MADEL)

    page = await list_seller_listings(offset=0, limit=50, context=context(), user=SELLER, db=pg_conn)
    assert [str(item.id) for item in page.items] == [L_NEWER, L_OLDER]
    assert page.total == 2
    assert str((await get_seller_listing(L_OLDER, context=context(), user=SELLER, db=pg_conn)).seller_id) == ORG_SELLER_ID

    for inaccessible in (L_OTHER_SELLER, L_OTHER_STORE, str(uuid.uuid4())):
        with pytest.raises(HTTPException) as error:
            await get_seller_listing(inaccessible, context=context(), user=SELLER, db=pg_conn)
        assert error.value.status_code == 404
        assert error.value.detail == "Listing not found"


@pytest.mark.asyncio
async def test_seller_update_changes_only_allowlisted_listing_fields(pg_conn):
    await setup_base_data(pg_conn)
    L_ID = "00000000-0000-0000-0000-000000000300"
    await seed_listing(pg_conn, listing_id=L_ID)
    
    response = await update_seller_listing(
        L_ID,
        SellerListingUpdate(title_override="Store title", price={"amount_minor": 2_000, "currency": "INR"}),
        context=context(),
        user=SELLER,
        db=pg_conn,
    )
    assert response.title == "Store title"
    assert response.price.amount_minor == 2_000
    with pytest.raises(ValidationError):
        SellerListingUpdate(product_id="00000000-0000-0000-0000-000000000400")


@pytest.mark.asyncio
async def test_seller_cannot_mutate_another_seller_or_storefront_listing(pg_conn):
    await setup_base_data(pg_conn)
    L_OTHER_SELLER = "00000000-0000-0000-0000-000000000203"
    L_OTHER_STORE = "00000000-0000-0000-0000-000000000204"
    await seed_listing(pg_conn, listing_id=L_OTHER_SELLER, seller_user=OTHER_SELLER)
    await seed_listing(
        pg_conn,
        listing_id=L_OTHER_STORE,
        product_id="00000000-0000-0000-0000-000000000102",
        storefront=StorefrontKey.MAHILA_MADEL,
    )
    for listing_id in (L_OTHER_SELLER, L_OTHER_STORE):
        with pytest.raises(HTTPException) as error:
            await update_seller_listing(
                listing_id,
                SellerListingUpdate(title_override="Forbidden"),
                context=context(),
                user=SELLER,
                db=pg_conn,
            )
        assert error.value.status_code == 404


@pytest.mark.asyncio
async def test_seller_inventory_update_is_owned_atomic_and_allows_zero(pg_conn):
    await setup_base_data(pg_conn)
    L_ID = "00000000-0000-0000-0000-000000000300"
    await seed_listing(pg_conn, listing_id=L_ID)
    response = await update_seller_inventory(
        L_ID, SellerInventoryUpdate(quantity=0), context=context(), user=SELLER, db=pg_conn
    )
    assert response.on_hand_quantity == 2 # 0 + 2 reserved = 2
    assert response.available_quantity == 0
    assert response.reserved_quantity == 2

    L_OTHER = "00000000-0000-0000-0000-000000000301"
    await seed_listing(pg_conn, listing_id=L_OTHER, product_id="00000000-0000-0000-0000-000000000102", seller_user=OTHER_SELLER)
    with pytest.raises(HTTPException) as error:
        await update_seller_inventory(
            L_OTHER, SellerInventoryUpdate(quantity=99), context=context(), user=SELLER, db=pg_conn
        )
    assert error.value.status_code == 404


@pytest.mark.asyncio
async def test_seller_inventory_read_cannot_cross_storefront(pg_conn):
    await setup_base_data(pg_conn)
    L_ID = "00000000-0000-0000-0000-000000000300"
    await seed_listing(pg_conn, listing_id=L_ID, storefront=StorefrontKey.MAHILA_MADEL)
    with pytest.raises(HTTPException) as error:
        await get_seller_inventory(L_ID, context=context(), user=SELLER, db=pg_conn)
    assert error.value.status_code == 404


@pytest.mark.asyncio
async def test_seller_lifecycle_is_controlled_and_rejected_transition_is_atomic(pg_conn):
    await setup_base_data(pg_conn)
    L_ID = "00000000-0000-0000-0000-000000000300"
    await seed_listing(pg_conn, listing_id=L_ID, status="active")
    paused = await change_seller_listing_lifecycle(
        L_ID, SellerListingLifecycleRequest(action="pause"), context=context(), user=SELLER, db=pg_conn
    )
    assert paused.status == "paused"
    with pytest.raises(HTTPException) as error:
        await change_seller_listing_lifecycle(
            L_ID, SellerListingLifecycleRequest(action="pause"), context=context(), user=SELLER, db=pg_conn
        )
    assert error.value.status_code == 400


@pytest.mark.asyncio
async def test_admin_inspection_is_storefront_scoped_and_exposes_safe_ownership(pg_conn):
    await setup_base_data(pg_conn)
    L_ID = "00000000-0000-0000-0000-000000000300"
    L_OTHER_STORE = "00000000-0000-0000-0000-000000000301"
    await seed_listing(pg_conn, listing_id=L_ID)
    await seed_listing(pg_conn, listing_id=L_OTHER_STORE, product_id="00000000-0000-0000-0000-000000000102", storefront=StorefrontKey.MAHILA_MADEL)
    page = await list_admin_listings(offset=0, limit=50, context=context(), _admin=ADMIN, db=pg_conn)
    assert [str(item.id) for item in page.items] == [L_ID]
    detail = await get_admin_listing(L_ID, context=context(), _admin=ADMIN, db=pg_conn)
    inventory = await get_admin_inventory(L_ID, context=context(), _admin=ADMIN, db=pg_conn)
    assert str(detail.seller_id) == ORG_SELLER_ID and detail.seller_name == SELLER["name"]
    assert str(inventory.seller_id) == ORG_SELLER_ID and inventory.available_quantity == 8
    with pytest.raises(HTTPException) as error:
        await get_admin_listing(L_OTHER_STORE, context=context(), _admin=ADMIN, db=pg_conn)
    assert error.value.status_code == 404


@pytest.mark.asyncio
async def test_admin_moderation_transition_is_controlled_and_atomic(pg_conn):
    await setup_base_data(pg_conn)
    L_ID = "00000000-0000-0000-0000-000000000300"
    await seed_listing(pg_conn, listing_id=L_ID, status="draft")
    approved = await moderate_admin_listing(
        L_ID,
        AdminListingModerationRequest(action="approve"),
        context=context(),
        admin=ADMIN,
        db=pg_conn,
    )
    assert approved.status == "active"
    stored = await pg_conn.fetchrow("SELECT listing_content FROM storefront_listing WHERE id = $1", uuid.UUID(L_ID))
    content = json.loads(stored["listing_content"])
    assert content["moderated_by"] == ADMIN["id"]

    with pytest.raises(HTTPException) as error:
        await moderate_admin_listing(
            L_ID,
            AdminListingModerationRequest(action="approve"),
            context=context(),
            admin=ADMIN,
            db=pg_conn,
        )
    assert error.value.status_code == 400


@pytest.mark.asyncio
async def test_seller_and_admin_http_authentication_boundaries(pg_conn):
    await setup_base_data(pg_conn)
    L_ID = "00000000-0000-0000-0000-000000000300"
    await seed_listing(pg_conn, listing_id=L_ID)
    
    app.dependency_overrides[pg_conn_dep] = lambda: pg_conn
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="https://api.zolexora.com") as client:
            unauthenticated = await client.get(
                "/api/seller/catalog/listings", headers={"X-Storefront-Key": "zolexora-shop"}
            )
            assert unauthenticated.status_code == 401

            app.dependency_overrides[current_user] = lambda: SELLER
            non_seller = await client.get(
                "/api/seller/catalog/listings", headers={"X-Storefront-Key": "zolexora-shop"}
            )
            assert non_seller.status_code == 200

            app.dependency_overrides[current_user] = lambda: {"id": str(uuid.uuid4()), "role": "viewer"}
            forbidden_seller = await client.get(
                "/api/seller/catalog/listings", headers={"X-Storefront-Key": "zolexora-shop"}
            )
            assert forbidden_seller.status_code == 403
            non_admin = await client.get(
                "/api/admin/catalog/listings", headers={"X-Storefront-Key": "zolexora-shop"}
            )
            assert non_admin.status_code == 403
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_forged_storefront_hint_fails_before_catalog_access(pg_conn):
    await setup_base_data(pg_conn)
    L_ID = "00000000-0000-0000-0000-000000000300"
    await seed_listing(pg_conn, listing_id=L_ID)
    
    app.dependency_overrides[pg_conn_dep] = lambda: pg_conn
    app.dependency_overrides[current_user] = lambda: SELLER
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="https://shop.zolexora.com") as client:
            response = await client.get(
                "/api/seller/catalog/listings", headers={"X-Storefront-Key": "mahila-madel"}
            )
        assert response.status_code == 400
        assert response.json()["code"] == "storefront_context_mismatch"
    finally:
        app.dependency_overrides.clear()


def test_openapi_portal_contracts_exclude_authority_and_internal_fields():
    schema = app.openapi()["components"]["schemas"]
    create_fields = schema["SellerListingCreate"]["properties"]
    update_fields = schema["SellerListingUpdate"]["properties"]
    moderation_fields = schema["AdminListingModerationRequest"]["properties"]
    inventory_quantity = schema["SellerInventoryUpdate"]["properties"]["quantity"]
    forbidden = {"seller_id", "storefront_id", "admin_role", "status", "reserved_quantity", "available_quantity"}
    assert forbidden.isdisjoint(create_fields | update_fields | moderation_fields)
    assert set(moderation_fields) == {"action", "reason"}
    assert inventory_quantity["type"] == "integer"
    assert inventory_quantity["minimum"] == 0
    assert inventory_quantity["maximum"] == MAX_INVENTORY_QUANTITY
    assert schema["Money"]["properties"]["amount_minor"]["maximum"] == MAX_INVENTORY_QUANTITY
    assert schema["SellerListingResponse"]["properties"]["created_at"]["format"] == "date-time"
    paths = app.openapi()["paths"]
    assert "put" not in paths["/api/admin/catalog/listings/{listing_id}/inventory"]
    assert "/api/admin/products" not in paths
    public_schemas = {
        name: schema[name] for name in schema if name.startswith(("Seller", "AdminListing", "AdminInventory"))
    }
    assert all("_id" not in model.get("properties", {}) for model in public_schemas.values())
    rendered = str(public_schemas).lower()
    for forbidden_name in ("credential", "secret", "provider", "merchant", "moderated_by"):
        assert forbidden_name not in rendered

