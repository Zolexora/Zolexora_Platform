from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from catalog import store as catalog_store
from core.deps import db_dep, current_user
from storefronts.dependencies import require_storefront_context
from storefronts.models import StorefrontContext

router = APIRouter(prefix="/wishlist", tags=["wishlist"])


@router.get("")
@router.get("/")
async def get_wishlist(
    context: StorefrontContext = Depends(require_storefront_context),
    user: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(db_dep),
):
    sf_key = str(context.key.value if hasattr(context.key, "value") else context.key)
    cursor = db.wishlist.find(
        {"user_id": user["id"], "storefront_id": sf_key},
        {"_id": 0}
    )
    wishlist_entries = await cursor.sort("created_at", -1).to_list(200)

    # Collect product IDs and resolve full product objects
    product_ids = [entry["product_id"] for entry in wishlist_entries if "product_id" in entry]
    if not product_ids:
        return []

    product_map = await catalog_store.public_listings(product_ids, sf_key)
    # Products in the order added; ones no longer for sale are left out
    resolved = [product_map[pid] for pid in product_ids if pid in product_map]

    return resolved


@router.post("/{product_id}")
async def toggle_wishlist_item(
    product_id: str,
    context: StorefrontContext = Depends(require_storefront_context),
    user: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(db_dep),
):
    sf_key = str(context.key.value if hasattr(context.key, "value") else context.key)
    
    existing = await db.wishlist.find_one({
        "user_id": user["id"],
        "product_id": product_id,
        "storefront_id": sf_key
    })

    if existing:
        await db.wishlist.delete_one({
            "user_id": user["id"],
            "product_id": product_id,
            "storefront_id": sf_key
        })
        added = False
    else:
        await db.wishlist.insert_one({
            "user_id": user["id"],
            "product_id": product_id,
            "storefront_id": sf_key,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        added = True

    # Retrieve updated wishlist
    cursor = db.wishlist.find(
        {"user_id": user["id"], "storefront_id": sf_key},
        {"_id": 0}
    )
    updated_entries = await cursor.sort("created_at", -1).to_list(200)

    product_ids = [entry["product_id"] for entry in updated_entries if "product_id" in entry]
    product_map = await catalog_store.public_listings(product_ids, sf_key)
    resolved = [product_map[e["product_id"]] for e in updated_entries if e.get("product_id") in product_map]

    return {
        "added": added,
        "product_id": product_id,
        "wishlist": resolved
    }


@router.delete("/{product_id}")
async def remove_wishlist_item(
    product_id: str,
    context: StorefrontContext = Depends(require_storefront_context),
    user: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(db_dep),
):
    sf_key = str(context.key.value if hasattr(context.key, "value") else context.key)
    result = await db.wishlist.delete_one({
        "user_id": user["id"],
        "product_id": product_id,
        "storefront_id": sf_key
    })

    return {
        "success": result.deleted_count > 0,
        "product_id": product_id
    }
