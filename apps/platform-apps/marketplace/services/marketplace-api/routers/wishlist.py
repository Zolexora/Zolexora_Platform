"""A buyer's wishlist per storefront (wishlist / wishlist_item); it lists products still for sale."""

import uuid

from fastapi import APIRouter, Depends, HTTPException

from catalog import store as catalog_store
from core.deps import current_user
from shared.database.postgres import pg_conn_dep
from storefronts.dependencies import require_storefront_context
from storefronts.models import StorefrontContext

router = APIRouter(prefix="/wishlist", tags=["wishlist"])


def _key(context: StorefrontContext) -> str:
    return str(getattr(context.key, "value", context.key))


async def _listing_ids(pg, buyer_id: str, sf_key: str) -> list[str]:
    rows = await pg.fetch(
        """SELECT i.storefront_listing_id FROM wishlist_item i JOIN wishlist w ON w.id = i.wishlist_id
           JOIN storefront s ON s.id = w.storefront_id
           WHERE w.buyer_id = $1 AND s.storefront_key = $2 ORDER BY i.added_at DESC LIMIT 200""",
        uuid.UUID(buyer_id), sf_key)
    return [str(r["storefront_listing_id"]) for r in rows]


async def _products(pg, buyer_id: str, sf_key: str) -> list:
    ids = await _listing_ids(pg, buyer_id, sf_key)
    products = await catalog_store.public_listings(ids, sf_key, pg)
    return [products[i] for i in ids if i in products]  # newest first; ones no longer for sale left out


async def _remove(pg, buyer_id: str, sf_key: str, product_id: str) -> bool:
    listing = catalog_store._uuid(product_id)
    return bool(listing and await pg.fetchval(
        """DELETE FROM wishlist_item i USING wishlist w, storefront s
           WHERE i.wishlist_id = w.id AND s.id = w.storefront_id AND w.buyer_id = $1 AND s.storefront_key = $2
             AND i.storefront_listing_id = $3 RETURNING true""",
        uuid.UUID(buyer_id), sf_key, listing))


@router.get("")
@router.get("/")
async def get_wishlist(context: StorefrontContext = Depends(require_storefront_context),
                       user: dict = Depends(current_user), pg=Depends(pg_conn_dep)):
    return await _products(pg, user["id"], _key(context))


@router.post("/{product_id}")
async def toggle_wishlist_item(product_id: str, context: StorefrontContext = Depends(require_storefront_context),
                               user: dict = Depends(current_user), pg=Depends(pg_conn_dep)):
    sf_key = _key(context)
    async with pg.transaction():
        added = not await _remove(pg, user["id"], sf_key, product_id)
        if added:
            if not await catalog_store.public_listings([product_id], sf_key, pg):
                raise HTTPException(404, "Product not found")
            wishlist_id = await pg.fetchval(
                """INSERT INTO wishlist (id, storefront_id, buyer_id) SELECT $1, s.id, $2 FROM storefront s WHERE s.storefront_key = $3
                   ON CONFLICT (buyer_id, storefront_id) WHERE buyer_id IS NOT NULL DO UPDATE SET updated_at = now()
                   RETURNING id""",
                uuid.uuid4(), uuid.UUID(user["id"]), sf_key)
            await pg.execute(
                """INSERT INTO wishlist_item (id, wishlist_id, storefront_listing_id) VALUES ($1, $2, $3)
                   ON CONFLICT (wishlist_id, storefront_listing_id) DO NOTHING""",
                uuid.uuid4(), wishlist_id, uuid.UUID(product_id))
    return {"added": added, "product_id": product_id, "wishlist": await _products(pg, user["id"], sf_key)}


@router.delete("/{product_id}")
async def remove_wishlist_item(product_id: str, context: StorefrontContext = Depends(require_storefront_context),
                               user: dict = Depends(current_user), pg=Depends(pg_conn_dep)):
    return {"success": await _remove(pg, user["id"], _key(context), product_id), "product_id": product_id}
