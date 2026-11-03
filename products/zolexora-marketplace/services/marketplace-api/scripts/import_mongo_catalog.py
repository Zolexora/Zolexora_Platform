"""Copies the legacy MongoDB catalog (master_products, storefront_listings, inventory_balances)
into the PostgreSQL catalog. Ids are kept, so carts, wishlists and orders keep resolving.

Each legacy seller (a user id, matched on users.id or users.auth_user_id) becomes their
oldest active organisation where they are OWNER; products of sellers without one are skipped
and reported. Dry run by default; pass --apply to write (one transaction, re-runnable).

  bash scripts/setup/with-infisical.sh products/zolexora-marketplace \
    python products/zolexora-marketplace/services/marketplace-api/scripts/import_mongo_catalog.py [--apply]
"""

import asyncio
import json
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from catalog.store import _category_id, _storefront_ids  # noqa: E402
from core.database import get_db  # noqa: E402
from shared.database.postgres import close_pool, connection, init_pool  # noqa: E402


class DryRun(Exception):
    pass


async def _org_for(conn, seller_id, cache: dict):
    if seller_id not in cache:
        try:
            uid = uuid.UUID(str(seller_id))
        except ValueError:
            uid = None
        cache[seller_id] = uid and await conn.fetchval(
            """SELECT m.organization_id FROM seller_org_member m
               JOIN users u ON u.id = m.user_id
               JOIN seller_organization o ON o.id = m.organization_id
               WHERE (u.id = $1 OR u.auth_user_id = $1) AND m.role = 'OWNER' AND m.status = 'ACTIVE'
                 AND o.status = 'ACTIVE'
               ORDER BY m.joined_at LIMIT 1""",
            uid,
        )
    return cache[seller_id]


def _money(value):
    return value if isinstance(value, dict) and "amount_minor" in value else None


async def run(apply: bool) -> None:
    mongo = get_db()
    masters = await mongo.master_products.find({}, {"_id": 0}).to_list(None)
    listings = await mongo.storefront_listings.find({}, {"_id": 0}).to_list(None)
    stock = {b["product_id"]: b for b in await mongo.inventory_balances.find({}, {"_id": 0}).to_list(None)}
    by_product: dict[str, list] = {}
    for listing in listings:
        by_product.setdefault(listing["product_id"], []).append(listing)

    report = {"products": 0, "listings": 0, "skipped_no_org": 0, "skipped_bad": 0, "already": 0}
    orgs: dict = {}
    await init_pool()
    try:
        async with connection() as conn:
            try:
                async with conn.transaction():
                    for m in masters:
                        org = await _org_for(conn, m.get("seller_id"), orgs)
                        price_listings = [x for x in by_product.get(m["id"], []) if _money(x.get("price"))]
                        if not org:
                            report["skipped_no_org"] += 1
                            continue
                        if not price_listings:
                            report["skipped_bad"] += 1
                            continue
                        pid = uuid.UUID(m["id"])
                        if await conn.fetchval("SELECT 1 FROM master_product WHERE id = $1", pid):
                            report["already"] += 1
                            continue
                        await conn.execute(
                            """INSERT INTO master_product (id, organization_id, category_id, slug, name, description, images, lifecycle_status)
                               VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)""",
                            pid, org, await _category_id(conn, m.get("category") or "Other"), f"legacy-{pid.hex}",
                            (m.get("title") or "Product")[:255], m.get("description") or "",
                            json.dumps((m.get("images") or [])[:10]), "ACTIVE" if m.get("is_active", True) else "ARCHIVED",
                        )
                        variant = uuid.uuid4()
                        await conn.execute("INSERT INTO product_variant (id, product_id, sku) VALUES ($1, $2, 'DEFAULT')", variant, pid)
                        on_hand = int((stock.get(m["id"]) or {}).get("available_quantity", 0))
                        await conn.execute(
                            """INSERT INTO inventory_ledger (id, variant_id, organization_id, on_hand_quantity, reserved_quantity)
                               VALUES ($1, $2, $3, $4, 0)""",
                            uuid.uuid4(), variant, org, on_hand,
                        )
                        await conn.execute(
                            """INSERT INTO inventory_audit_log (id, variant_id, organization_id, change_quantity, reason)
                               VALUES ($1, $2, $3, $4, 'legacy_import')""",
                            uuid.uuid4(), variant, org, on_hand,
                        )
                        stores = await _storefront_ids(conn, {x["storefront_id"] for x in price_listings})
                        for x in price_listings:
                            content = {k: x.get(k) for k in ("title_override", "description_override", "images_override",
                                                             "rating", "reviews_count") if x.get(k) is not None}
                            content.update(price=x["price"], compare_at_price=_money(x.get("compare_at_price")),
                                           status=x.get("status", "draft"))
                            await conn.execute(
                                """INSERT INTO storefront_listing (id, storefront_id, organization_id, product_id, publication_state, listing_content)
                                   VALUES ($1, $2, $3, $4, $5, $6::json)
                                   ON CONFLICT DO NOTHING""",
                                uuid.UUID(x["id"]), stores[x["storefront_id"]], org, pid,
                                "PUBLISHED" if x.get("status") == "active" else "HIDDEN", json.dumps(content),
                            )
                            report["listings"] += 1
                        report["products"] += 1
                    if not apply:
                        raise DryRun
            except DryRun:
                pass
    finally:
        await close_pool()
    print(("Imported" if apply else "Dry run (nothing written; pass --apply)") + f": {report}")
    unmapped = sorted(str(k) for k, v in orgs.items() if not v)
    if unmapped:
        print(f"Sellers with no active owned organisation ({len(unmapped)}): {', '.join(unmapped[:20])}")


if __name__ == "__main__":
    asyncio.run(run("--apply" in sys.argv))
