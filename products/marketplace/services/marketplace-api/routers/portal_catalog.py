import json
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from asyncpg import Connection

from core.deps import admin_only, current_user
from shared.database.postgres import pg_conn_dep
from models.portal_catalog import (
    AdminInventoryResponse,
    AdminListingModerationRequest,
    AdminListingPage,
    AdminListingResponse,
    AdminListingSummary,
    ListingModerationAction,
    ListingStatus,
    SellerInventoryResponse,
    SellerInventoryUpdate,
    SellerListingCreate,
    SellerListingLifecycleAction,
    SellerListingLifecycleRequest,
    SellerListingPage,
    SellerListingResponse,
    SellerListingSummary,
    SellerListingUpdate,
)
from models.primitives import Money
from storefronts.dependencies import require_storefront_context
from storefronts.models import StorefrontContext

seller_catalog_router = APIRouter(prefix="/seller/catalog", tags=["seller-catalog"])
admin_catalog_router = APIRouter(prefix="/admin/catalog", tags=["admin-catalog"])

async def seller_actor(user=Depends(current_user)):
    if user.get("role") != "seller":
        raise HTTPException(403, "Sellers only")
    return user

async def get_seller_org(user, db: Connection) -> UUID:
    org_id = await db.fetchval(
        """
        SELECT m.organization_id 
        FROM seller_org_member m
        JOIN seller_organization o ON m.organization_id = o.id
        WHERE m.user_id = $1 AND m.status = 'ACTIVE' AND o.status = 'ACTIVE'
        LIMIT 1
        """,
        UUID(user["id"])
    )
    if not org_id:
        raise HTTPException(403, "Seller organization not found")
    return org_id

def map_status_to_db(status: str) -> str:
    if status == ListingStatus.ACTIVE: return "PUBLISHED"
    if status == ListingStatus.PAUSED: return "HIDDEN"
    if status in (ListingStatus.REJECTED, ListingStatus.ARCHIVED): return "SUSPENDED"
    return "DRAFT"

async def _listing_response(
    db: Connection,
    listing: dict,
    *,
    admin: bool = False,
) -> SellerListingResponse | AdminListingResponse:
    master_query = """
        SELECT m.id, m.organization_id, m.name as title, m.description, o.name as seller_name
        FROM master_product m
        JOIN seller_organization o ON m.organization_id = o.id
        WHERE m.id = $1 AND m.organization_id = $2
    """
    master = await db.fetchrow(master_query, listing["product_id"], listing["organization_id"])
    
    inventory_query = """
        SELECT available_quantity, reserved_quantity, on_hand_quantity
        FROM inventory_balance
        WHERE product_id = $1 AND seller_id = $2
    """
    inventory = await db.fetchrow(inventory_query, listing["product_id"], listing["organization_id"])
    
    if not master or not inventory:
        raise HTTPException(404, "Listing not found")

    on_hand = inventory["on_hand_quantity"] or 0
    reserved = inventory["reserved_quantity"] or 0
    content = json.loads(listing["listing_content"]) if listing.get("listing_content") else {}
    
    sf_key = await db.fetchval("SELECT storefront_key FROM storefront WHERE id = $1", listing["storefront_id"])
    
    response = {
        "id": str(listing["id"]),
        "storefront_id": sf_key,
        "product_id": str(listing["product_id"]),
        "seller_id": str(listing["organization_id"]),
        "seller_name": master["seller_name"] or "Unknown",
        "title": content.get("title_override") or master["title"],
        "description": content.get("description_override") or master["description"],
        "price": content.get("price"),
        "compare_at_price": content.get("compare_at_price"),
        "status": content.get("status", ListingStatus.DRAFT),
        "title_override": content.get("title_override"),
        "description_override": content.get("description_override"),
        "images_override": content.get("images_override"),
        "moderation_reason": content.get("moderation_reason"),
        "available_quantity": max(on_hand - reserved, 0),
        "created_at": listing["created_at"],
        "updated_at": listing.get("updated_at", listing["created_at"]),
    }
    model = AdminListingResponse if admin else SellerListingResponse
    return model.model_validate(response)

async def _inventory_response(
    db: Connection,
    listing: dict,
    *,
    admin: bool = False,
) -> SellerInventoryResponse | AdminInventoryResponse:
    inventory = await db.fetchrow(
        "SELECT on_hand_quantity, reserved_quantity, updated_at FROM inventory_balance WHERE product_id = $1 AND seller_id = $2",
        listing["product_id"], listing["organization_id"]
    )
    if not inventory:
        raise HTTPException(404, "Inventory not found")

    sf_key = await db.fetchval("SELECT storefront_key FROM storefront WHERE id = $1", listing["storefront_id"])
    on_hand = inventory["on_hand_quantity"] or 0
    reserved = inventory["reserved_quantity"] or 0
    
    response = {
        "storefront_id": sf_key,
        "listing_id": str(listing["id"]),
        "product_id": str(listing["product_id"]),
        "seller_id": str(listing["organization_id"]),
        "on_hand_quantity": on_hand,
        "reserved_quantity": reserved,
        "available_quantity": max(on_hand - reserved, 0),
        "updated_at": inventory["updated_at"],
    }
    model = AdminInventoryResponse if admin else SellerInventoryResponse
    return model.model_validate(response)

def _validate_currency(context: StorefrontContext, price, compare_at_price=None) -> None:
    if price.currency != context.storefront.currency:
        raise HTTPException(400, "Listing currency must match the storefront currency")
    if compare_at_price:
        if compare_at_price.currency != price.currency:
            raise HTTPException(400, "Listing prices must use one currency")
        if compare_at_price.amount_minor < price.amount_minor:
            raise HTTPException(400, "Compare-at price cannot be less than listing price")

@seller_catalog_router.get("/listings", response_model=SellerListingPage)
async def list_seller_listings(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(seller_actor),
    db: Connection = Depends(pg_conn_dep),
):
    org_id = await get_seller_org(user, db)
    sf_id = (await db.fetchval("SELECT id FROM storefront WHERE storefront_key = $1", context.key)) or uuid4()
    
    query = """
        SELECT id, storefront_id, organization_id, product_id, publication_state, listing_content, created_at, updated_at
        FROM storefront_listing
        WHERE storefront_id = $1 AND organization_id = $2
        ORDER BY created_at DESC, id ASC
        OFFSET $3 LIMIT $4
    """
    listings = await db.fetch(query, sf_id, org_id, offset, limit)
    total = await db.fetchval("SELECT count(*) FROM storefront_listing WHERE storefront_id = $1 AND organization_id = $2", sf_id, org_id)
    
    items = []
    for listing in listings:
        detail = await _listing_response(db, dict(listing))
        items.append(SellerListingSummary.model_validate(detail.model_dump()))
    return SellerListingPage(items=items, total=total, offset=offset, limit=limit)

@seller_catalog_router.post("/listings", response_model=SellerListingResponse, status_code=201)
async def create_seller_listing(
    data: SellerListingCreate,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(seller_actor),
    db: Connection = Depends(pg_conn_dep),
):
    org_id = await get_seller_org(user, db)
    sf_id = (await db.fetchval("SELECT id FROM storefront WHERE storefront_key = $1", context.key))
    if not sf_id:
        raise HTTPException(404, "Storefront not found")
        
    _validate_currency(context, data.price, data.compare_at_price)
    
    master = await db.fetchrow("SELECT id FROM master_product WHERE id = $1 AND organization_id = $2 AND lifecycle_status = 'ACTIVE'", UUID(str(data.product_id)), org_id)
    inventory = await db.fetchrow("SELECT product_id FROM inventory_balance WHERE product_id = $1 AND seller_id = $2", UUID(str(data.product_id)), org_id)
    
    if not master or not inventory:
        raise HTTPException(404, "Eligible product not found")
        
    duplicate_with_status = await db.fetchrow(
        """
        SELECT id FROM storefront_listing 
        WHERE storefront_id = $1 AND product_id = $2 AND organization_id = $3
        AND (listing_content->>'status' != 'archived' OR listing_content->>'status' IS NULL)
        """,
        sf_id, UUID(str(data.product_id)), org_id
    )
    if duplicate_with_status:
        raise HTTPException(409, "A listing already exists for this product and storefront")

    now = datetime.now(timezone.utc)
    listing_id = uuid4()
    
    content = {
        "price": data.price.model_dump(),
        "compare_at_price": data.compare_at_price.model_dump() if data.compare_at_price else None,
        "status": ListingStatus.DRAFT,
        "title_override": data.title_override,
        "description_override": data.description_override,
        "images_override": data.images_override,
    }
    
    await db.execute(
        """
        INSERT INTO storefront_listing (id, storefront_id, organization_id, product_id, publication_state, listing_content, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        """,
        listing_id, sf_id, org_id, UUID(str(data.product_id)), "DRAFT", json.dumps(content), now, now
    )
    
    listing = await db.fetchrow("SELECT * FROM storefront_listing WHERE id = $1", listing_id)
    return await _listing_response(db, dict(listing))

@seller_catalog_router.get("/listings/{listing_id}", response_model=SellerListingResponse)
async def get_seller_listing(
    listing_id: str,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(seller_actor),
    db: Connection = Depends(pg_conn_dep),
):
    org_id = await get_seller_org(user, db)
    sf_id = await db.fetchval("SELECT id FROM storefront WHERE storefront_key = $1", context.key)
    try:
        lid = UUID(listing_id)
    except ValueError:
        raise HTTPException(404, "Listing not found")
    listing = await db.fetchrow("SELECT * FROM storefront_listing WHERE id = $1 AND storefront_id = $2 AND organization_id = $3", lid, sf_id, org_id)
    if not listing:
        raise HTTPException(404, "Listing not found")
    return await _listing_response(db, dict(listing))

@seller_catalog_router.put("/listings/{listing_id}", response_model=SellerListingResponse)
async def update_seller_listing(
    listing_id: str,
    data: SellerListingUpdate,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(seller_actor),
    db: Connection = Depends(pg_conn_dep),
):
    org_id = await get_seller_org(user, db)
    sf_id = await db.fetchval("SELECT id FROM storefront WHERE storefront_key = $1", context.key)
    try:
        lid = UUID(listing_id)
    except ValueError:
        raise HTTPException(404, "Listing not found")
    listing = await db.fetchrow("SELECT * FROM storefront_listing WHERE id = $1 AND storefront_id = $2 AND organization_id = $3", lid, sf_id, org_id)
    
    if not listing:
        raise HTTPException(404, "Listing not found")
    
    content = json.loads(listing["listing_content"]) if listing.get("listing_content") else {}
    if content.get("status") == ListingStatus.ARCHIVED:
        raise HTTPException(404, "Listing not found")

    price = data.price or Money.model_validate(content["price"])
    compare = data.compare_at_price if "compare_at_price" in data.model_fields_set else content.get("compare_at_price")
    if isinstance(compare, dict):
        compare = Money.model_validate(compare)
    _validate_currency(context, price, compare)

    updates = data.model_dump(exclude_unset=True)
    for field in ("price", "compare_at_price"):
        if field in updates and updates[field] is not None:
            updates[field] = updates[field].model_dump() if hasattr(updates[field], "model_dump") else updates[field]
            
    content.update(updates)
    
    now = datetime.now(timezone.utc)
    result = await db.execute(
        "UPDATE storefront_listing SET listing_content = $1, updated_at = $2 WHERE id = $3",
        json.dumps(content), now, lid
    )
    if result == "UPDATE 0":
        raise HTTPException(404, "Listing not found")
        
    updated = await db.fetchrow("SELECT * FROM storefront_listing WHERE id = $1", lid)
    return await _listing_response(db, dict(updated))

@seller_catalog_router.get("/listings/{listing_id}/inventory", response_model=SellerInventoryResponse)
async def get_seller_inventory(
    listing_id: str,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(seller_actor),
    db: Connection = Depends(pg_conn_dep),
):
    org_id = await get_seller_org(user, db)
    sf_id = await db.fetchval("SELECT id FROM storefront WHERE storefront_key = $1", context.key)
    try:
        lid = UUID(listing_id)
    except ValueError:
        raise HTTPException(404, "Listing not found")
    listing = await db.fetchrow("SELECT * FROM storefront_listing WHERE id = $1 AND storefront_id = $2 AND organization_id = $3", lid, sf_id, org_id)
    if not listing:
        raise HTTPException(404, "Listing not found")
    return await _inventory_response(db, dict(listing))

@seller_catalog_router.put("/listings/{listing_id}/inventory", response_model=SellerInventoryResponse)
async def update_seller_inventory(
    listing_id: str,
    data: SellerInventoryUpdate,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(seller_actor),
    db: Connection = Depends(pg_conn_dep),
):
    org_id = await get_seller_org(user, db)
    sf_id = await db.fetchval("SELECT id FROM storefront WHERE storefront_key = $1", context.key)
    try:
        lid = UUID(listing_id)
    except ValueError:
        raise HTTPException(404, "Listing not found")
    listing = await db.fetchrow("SELECT * FROM storefront_listing WHERE id = $1 AND storefront_id = $2 AND organization_id = $3", lid, sf_id, org_id)
    if not listing:
        raise HTTPException(404, "Listing not found")
        
    await db.execute(
        "UPDATE inventory_balance SET on_hand_quantity = $1, updated_at = $2 WHERE product_id = $3 AND seller_id = $4",
        data.quantity + (await db.fetchval("SELECT reserved_quantity FROM inventory_balance WHERE product_id=$1 AND seller_id=$2", listing["product_id"], org_id) or 0), 
        datetime.now(timezone.utc), listing["product_id"], org_id
    ) # Wait, API expects on_hand_quantity to be updated. But the input data.quantity is available_quantity?
    # data.quantity in SellerInventoryUpdate is quantity.
    # The original mongo code was: {"$set": {"available_quantity": data.quantity, "updated_at": datetime.now(timezone.utc)}}
    # Since in Postgres available_quantity is computed as on_hand_quantity - reserved_quantity,
    # To set available_quantity = X, we must set on_hand_quantity = X + reserved_quantity.
    # Actually wait. Let me do this carefully.
    reserved = await db.fetchval("SELECT reserved_quantity FROM inventory_balance WHERE product_id=$1 AND seller_id=$2", listing["product_id"], org_id)
    if reserved is None:
        raise HTTPException(404, "Inventory not found")
    
    await db.execute(
        "UPDATE inventory_balance SET on_hand_quantity = $1, updated_at = $2 WHERE product_id = $3 AND seller_id = $4",
        data.quantity + reserved, datetime.now(timezone.utc), listing["product_id"], org_id
    )
    return await _inventory_response(db, dict(listing))


@seller_catalog_router.put("/listings/{listing_id}/lifecycle", response_model=SellerListingResponse)
async def change_seller_listing_lifecycle(
    listing_id: str,
    data: SellerListingLifecycleRequest,
    context: StorefrontContext = Depends(require_storefront_context),
    user=Depends(seller_actor),
    db: Connection = Depends(pg_conn_dep),
):
    org_id = await get_seller_org(user, db)
    sf_id = await db.fetchval("SELECT id FROM storefront WHERE storefront_key = $1", context.key)
    try:
        lid = UUID(listing_id)
    except ValueError:
        raise HTTPException(404, "Listing not found")
    listing = await db.fetchrow("SELECT * FROM storefront_listing WHERE id = $1 AND storefront_id = $2 AND organization_id = $3", lid, sf_id, org_id)
    if not listing:
        raise HTTPException(404, "Listing not found")
        
    content = json.loads(listing["listing_content"]) if listing.get("listing_content") else {}
    current = ListingStatus(content.get("status", ListingStatus.DRAFT))
    
    transitions = {
        SellerListingLifecycleAction.PAUSE: ({ListingStatus.ACTIVE}, ListingStatus.PAUSED),
        SellerListingLifecycleAction.RESUME: ({ListingStatus.PAUSED}, ListingStatus.ACTIVE),
        SellerListingLifecycleAction.ARCHIVE: (
            {ListingStatus.DRAFT, ListingStatus.ACTIVE, ListingStatus.PAUSED, ListingStatus.REJECTED},
            ListingStatus.ARCHIVED,
        ),
    }
    allowed, target = transitions[data.action]
    if current not in allowed:
        raise HTTPException(400, f"Cannot {data.action.value} a {current.value} listing")
        
    content["status"] = target
    db_state = map_status_to_db(target)
    now = datetime.now(timezone.utc)
    
    result = await db.execute(
        "UPDATE storefront_listing SET publication_state = $1, listing_content = $2, updated_at = $3 WHERE id = $4 AND publication_state = $5",
        db_state, json.dumps(content), now, lid, listing["publication_state"]
    )
    if result == "UPDATE 0":
        raise HTTPException(409, "Listing changed concurrently")
        
    updated = await db.fetchrow("SELECT * FROM storefront_listing WHERE id = $1", lid)
    return await _listing_response(db, dict(updated))

@admin_catalog_router.get("/listings", response_model=AdminListingPage)
async def list_admin_listings(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    context: StorefrontContext = Depends(require_storefront_context),
    _admin=Depends(admin_only),
    db: Connection = Depends(pg_conn_dep),
):
    sf_id = await db.fetchval("SELECT id FROM storefront WHERE storefront_key = $1", context.key)
    query = """
        SELECT *
        FROM storefront_listing
        WHERE storefront_id = $1
        ORDER BY created_at DESC, id ASC
        OFFSET $2 LIMIT $3
    """
    listings = await db.fetch(query, sf_id, offset, limit)
    total = await db.fetchval("SELECT count(*) FROM storefront_listing WHERE storefront_id = $1", sf_id)
    
    items = []
    for listing in listings:
        detail = await _listing_response(db, dict(listing), admin=True)
        items.append(AdminListingSummary.model_validate(detail.model_dump()))
    return AdminListingPage(items=items, total=total, offset=offset, limit=limit)

@admin_catalog_router.get("/listings/{listing_id}", response_model=AdminListingResponse)
async def get_admin_listing(
    listing_id: str,
    context: StorefrontContext = Depends(require_storefront_context),
    _admin=Depends(admin_only),
    db: Connection = Depends(pg_conn_dep),
):
    sf_id = await db.fetchval("SELECT id FROM storefront WHERE storefront_key = $1", context.key)
    try:
        lid = UUID(listing_id)
    except ValueError:
        raise HTTPException(404, "Listing not found")
    listing = await db.fetchrow("SELECT * FROM storefront_listing WHERE id = $1 AND storefront_id = $2", lid, sf_id)
    if not listing:
        raise HTTPException(404, "Listing not found")
    return await _listing_response(db, dict(listing), admin=True)


@admin_catalog_router.get("/listings/{listing_id}/inventory", response_model=AdminInventoryResponse)
async def get_admin_inventory(
    listing_id: str,
    context: StorefrontContext = Depends(require_storefront_context),
    _admin=Depends(admin_only),
    db: Connection = Depends(pg_conn_dep),
):
    sf_id = await db.fetchval("SELECT id FROM storefront WHERE storefront_key = $1", context.key)
    try:
        lid = UUID(listing_id)
    except ValueError:
        raise HTTPException(404, "Listing not found")
    listing = await db.fetchrow("SELECT * FROM storefront_listing WHERE id = $1 AND storefront_id = $2", lid, sf_id)
    if not listing:
        raise HTTPException(404, "Listing not found")
    return await _inventory_response(db, dict(listing), admin=True)


@admin_catalog_router.put("/listings/{listing_id}/moderation", response_model=AdminListingResponse)
async def moderate_admin_listing(
    listing_id: str,
    data: AdminListingModerationRequest,
    context: StorefrontContext = Depends(require_storefront_context),
    admin=Depends(admin_only),
    db: Connection = Depends(pg_conn_dep),
):
    sf_id = await db.fetchval("SELECT id FROM storefront WHERE storefront_key = $1", context.key)
    try:
        lid = UUID(listing_id)
    except ValueError:
        raise HTTPException(404, "Listing not found")
    listing = await db.fetchrow("SELECT * FROM storefront_listing WHERE id = $1 AND storefront_id = $2", lid, sf_id)
    if not listing:
        raise HTTPException(404, "Listing not found")
        
    content = json.loads(listing["listing_content"]) if listing.get("listing_content") else {}
    current = ListingStatus(content.get("status", ListingStatus.DRAFT))
    
    allowed = {
        ListingModerationAction.APPROVE: {ListingStatus.DRAFT, ListingStatus.REJECTED},
        ListingModerationAction.REJECT: {ListingStatus.DRAFT, ListingStatus.ACTIVE, ListingStatus.PAUSED},
    }[data.action]
    
    target = ListingStatus.ACTIVE if data.action == ListingModerationAction.APPROVE else ListingStatus.REJECTED
    if current not in allowed:
        raise HTTPException(400, f"Cannot {data.action.value} a {current.value} listing")
        
    content["status"] = target
    if target == ListingStatus.REJECTED:
        content["moderation_reason"] = data.reason
    else:
        content.pop("moderation_reason", None)
        
    content["moderated_by"] = admin["id"]
    now = datetime.now(timezone.utc)
    content["moderated_at"] = now.isoformat()
    
    db_state = map_status_to_db(target)
    
    result = await db.execute(
        "UPDATE storefront_listing SET publication_state = $1, listing_content = $2, updated_at = $3 WHERE id = $4 AND publication_state = $5",
        db_state, json.dumps(content), now, lid, listing["publication_state"]
    )
    if result == "UPDATE 0":
        raise HTTPException(409, "Listing changed concurrently")
        
    updated = await db.fetchrow("SELECT * FROM storefront_listing WHERE id = $1", lid)
    return await _listing_response(db, dict(updated), admin=True)
