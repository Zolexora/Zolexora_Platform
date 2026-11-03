"""A stand-in for catalog.store's buyer lookups in cart/checkout/order unit tests.

Those tests run on fake Mongo collections and seed listings, master products and stock there;
a fake DB that calls use(self) makes those seeds the catalog. The real PostgreSQL catalog is
tested in test_catalog_store.py.
"""

from models.catalog import ProductListingResponse

_current = None


def use(db) -> None:
    global _current
    _current = db


def reset() -> None:
    use(None)


async def public_listing(listing_id, storefront_key, conn=None):
    db = _current
    query = {"id": listing_id, "status": "active", **({"storefront_id": storefront_key} if storefront_key else {})}
    listing = await db.storefront_listings.find_one(query)
    if not listing:
        return None
    master = await db.master_products.find_one({"id": listing["product_id"]}) or {}
    stock = await db.inventory_balances.find_one({"product_id": listing["product_id"]}) or {}
    return ProductListingResponse(
        id=listing["id"], storefront_id=listing["storefront_id"], seller_id=listing["seller_id"],
        seller_name=master.get("seller_name", "Seller"), title=listing.get("title_override") or master.get("title", "Product"),
        description=master.get("description", ""), price=listing["price"], category=master.get("category", "Other"),
        images=listing.get("images_override") or master.get("images", []),
        stock=stock.get("available_quantity", 0) - stock.get("reserved_quantity", 0), is_active=True, rating=0.0, reviews_count=0,
        created_at="2026-01-01T00:00:00+00:00",
    )


async def public_listings(listing_ids, storefront_key, conn=None):
    found = {i: await public_listing(i, storefront_key) for i in listing_ids}
    return {i: p for i, p in found.items() if p}


def active() -> bool:
    return _current is not None
