from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

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

    products = await db.products.find(
        {"id": {"$in": product_ids}, "storefront_id": sf_key},
        {"_id": 0}
    ).to_list(len(product_ids))

    product_map = {p["id"]: p for p in products}
    # Return mapped products in the order added
    resolved = []
    for entry in wishlist_entries:
        pid = entry.get("product_id")
        if pid and pid in product_map:
            resolved.append(product_map[pid])
        elif entry:
            resolved.append(entry)

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
    products = await db.products.find(
        {"id": {"$in": product_ids}, "storefront_id": sf_key},
        {"_id": 0}
    ).to_list(len(product_ids)) if product_ids else []

    product_map = {p["id"]: p for p in products}
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
