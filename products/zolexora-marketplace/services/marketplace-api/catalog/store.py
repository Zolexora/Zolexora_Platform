"""The marketplace catalog in PostgreSQL (the single commerce source of truth).

A product is a master_product owned by a seller organisation, with one default variant whose
stock lives in inventory_ledger. It is sold on storefronts through storefront_listing rows
(price and status in listing_content). The API exposes the listing id as the product id.
Shoppers only see listings that are published, of an active product and organisation, on a
storefront the organisation holds an approved grant for.
"""

import json
import re
import uuid
from contextlib import asynccontextmanager

import asyncpg
from fastapi import HTTPException

from models.catalog import ProductListingResponse
from shared.database.postgres import connection

_SELECT = """
SELECT l.id, l.product_id, l.organization_id, l.listing_content, l.publication_state, l.created_at,
       s.storefront_key, m.name, m.description, m.images, o.name AS seller_name,
       COALESCE(c.name, 'Other') AS category,
       COALESCE((SELECT SUM(il.on_hand_quantity - il.reserved_quantity
                            + COALESCE((SELECT SUM(r.quantity) FROM inventory_reservation r  -- lapsed holds are free
                                        WHERE r.variant_id = v.id AND r.organization_id = il.organization_id
                                          AND r.status = 'ACTIVE' AND r.expires_at < now()), 0))
                 FROM product_variant v
                 JOIN inventory_ledger il ON il.variant_id = v.id AND il.organization_id = l.organization_id
                                         AND il.status = 'ACTIVE'
                 WHERE v.product_id = l.product_id AND v.is_active), 0)::bigint AS stock,
       ARRAY(SELECT s2.storefront_key FROM storefront_listing l2 JOIN storefront s2 ON s2.id = l2.storefront_id
             WHERE l2.product_id = l.product_id ORDER BY s2.storefront_key) AS storefront_keys
FROM storefront_listing l
JOIN storefront s ON s.id = l.storefront_id
JOIN master_product m ON m.id = l.product_id
JOIN seller_organization o ON o.id = l.organization_id
LEFT JOIN category c ON c.id = m.category_id
"""

# What shoppers may see (and buy).
VISIBLE = """l.publication_state = 'PUBLISHED' AND m.lifecycle_status = 'ACTIVE' AND o.status = 'ACTIVE'
  AND EXISTS (SELECT 1 FROM seller_storefront_grant g
              WHERE g.organization_id = l.organization_id AND g.storefront_id = l.storefront_id
                AND g.grant_status = 'APPROVED'
                AND (g.effective_at IS NULL OR g.effective_at <= NOW())
                AND (g.revoked_at IS NULL OR g.revoked_at > NOW()))"""

_PRICE = "((l.listing_content->'price'->>'amount_minor')::bigint)"
_SORTS = {
    "newest": "l.created_at DESC, l.id",
    "price_asc": f"{_PRICE} ASC, l.id",
    "price_desc": f"{_PRICE} DESC, l.id",
    "popular": "COALESCE((l.listing_content->>'reviews_count')::int, 0) DESC, l.created_at DESC, l.id",
}


@asynccontextmanager
async def _conn(conn: asyncpg.Connection | None):
    if conn is not None:
        yield conn
    else:
        async with connection() as value:
            yield value


def _uuid(value) -> uuid.UUID | None:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError):
        return None


def _json(value) -> dict | list:
    return json.loads(value) if isinstance(value, str) else (value or {})


def to_response(row) -> ProductListingResponse:
    content = _json(row["listing_content"])
    images = content.get("images_override") or _json(row["images"]) or []
    return ProductListingResponse(
        id=str(row["id"]),
        storefront_id=row["storefront_key"],
        storefront_ids=list(row["storefront_keys"]),
        seller_id=str(row["organization_id"]),
        seller_name=row["seller_name"],
        title=content.get("title_override") or row["name"],
        description=content.get("description_override") or row["description"] or "",
        price=content["price"],
        original_price=content.get("compare_at_price"),
        discount_percent=0.0,
        category=row["category"],
        images=images,
        stock=max(row["stock"], 0),
        is_active=row["publication_state"] == "PUBLISHED",
        rating=float(content.get("rating", 0.0)),
        reviews_count=int(content.get("reviews_count", 0)),
        created_at=row["created_at"].isoformat(),
    )


async def list_public(conn, storefront_key: str, *, category=None, search=None, min_minor=None, max_minor=None,
                      sort="newest", limit=40, skip=0) -> list[ProductListingResponse]:
    args: list = [storefront_key]
    where = [VISIBLE, "s.storefront_key = $1"]
    if category and category != "All":
        args.append(category)
        where.append(f"c.name = ${len(args)}")
    if search:
        args.append(f"%{search}%")
        where.append(f"(m.name ILIKE ${len(args)} OR m.description ILIKE ${len(args)})")
    if min_minor is not None:
        args.append(min_minor)
        where.append(f"{_PRICE} >= ${len(args)}")
    if max_minor is not None:
        args.append(max_minor)
        where.append(f"{_PRICE} <= ${len(args)}")
    args += [max(1, min(limit, 100)), max(skip, 0)]
    rows = await conn.fetch(
        f"{_SELECT} WHERE {' AND '.join(where)} ORDER BY {_SORTS.get(sort, _SORTS['newest'])} "
        f"LIMIT ${len(args) - 1} OFFSET ${len(args)}",
        *args,
    )
    return [to_response(r) for r in rows]


async def public_listings(listing_ids, storefront_key: str, conn=None) -> dict[str, ProductListingResponse]:
    """Buyable listings by id on one storefront (cart, checkout, wishlist)."""
    ids = [i for i in (_uuid(v) for v in listing_ids) if i]
    if not ids:
        return {}
    async with _conn(conn) as db:
        rows = await db.fetch(f"{_SELECT} WHERE {VISIBLE} AND s.storefront_key = $1 AND l.id = ANY($2::uuid[])",
                              storefront_key, ids)
    return {str(r["id"]): to_response(r) for r in rows}


async def public_listing(listing_id, storefront_key: str | None, conn=None) -> ProductListingResponse | None:
    lid = _uuid(listing_id)
    if not lid:
        return None
    async with _conn(conn) as db:
        row = await db.fetchrow(
            f"{_SELECT} WHERE {VISIBLE} AND l.id = $1 AND ($2::text IS NULL OR s.storefront_key = $2)",
            lid, storefront_key,
        )
    return to_response(row) if row else None


async def seller_products(conn, org_id, storefront_key: str | None) -> list[ProductListingResponse]:
    """One entry per product of the organisation (its first listing, optionally on one storefront)."""
    rows = await conn.fetch(
        f"""SELECT * FROM ({_SELECT} WHERE l.organization_id = $1 AND ($2::text IS NULL OR s.storefront_key = $2)
                           AND m.lifecycle_status <> 'ARCHIVED') x
            ORDER BY x.created_at DESC""",
        _uuid(org_id), storefront_key,
    )
    seen, out = set(), []
    for row in rows:
        if row["product_id"] not in seen:
            seen.add(row["product_id"])
            out.append(to_response(row))
    return out


async def all_listings(conn, storefront_key: str | None) -> list[ProductListingResponse]:
    rows = await conn.fetch(f"{_SELECT} WHERE ($1::text IS NULL OR s.storefront_key = $1) ORDER BY l.created_at DESC LIMIT 500",
                            storefront_key)
    return [to_response(r) for r in rows]


async def listing_counts(conn, storefront_key: str | None) -> dict:
    row = await conn.fetchrow(
            """SELECT count(*) AS total, count(*) FILTER (WHERE l.publication_state = 'PUBLISHED') AS active
               FROM storefront_listing l JOIN storefront s ON s.id = l.storefront_id
           WHERE $1::text IS NULL OR s.storefront_key = $1""",
        storefront_key,
    )
    return {"total_products": row["total"], "active_products": row["active"]}


async def find_listing(conn, listing_or_product_id, org_id=None, storefront_key=None):
    """A listing row by listing id (or product id), scoped to an organisation unless org_id is None."""
    ident = _uuid(listing_or_product_id)
    if not ident:
        return None
    return await conn.fetchrow(
        """SELECT l.* FROM storefront_listing l JOIN storefront s ON s.id = l.storefront_id
           WHERE (l.id = $1 OR l.product_id = $1)
             AND ($2::uuid IS NULL OR l.organization_id = $2)
             AND ($3::text IS NULL OR s.storefront_key = $3)
           ORDER BY (l.id = $1) DESC, l.created_at LIMIT 1""",
        ident, _uuid(org_id) if org_id else None, storefront_key,
    )


async def _storefront_ids(conn, keys) -> dict[str, uuid.UUID]:
    keys = sorted({str(getattr(k, "value", k)) for k in keys})
    rows = await conn.fetch("SELECT storefront_key, id FROM storefront WHERE storefront_key = ANY($1::text[])", keys)
    found = {r["storefront_key"]: r["id"] for r in rows}
    missing = set(keys) - set(found)
    if missing:
        raise HTTPException(400, f"Unknown storefront: {', '.join(sorted(missing))}")
    return found


async def _category_id(conn, name: str) -> uuid.UUID:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "other"
    return await conn.fetchval(
        """INSERT INTO category (id, slug, name) VALUES ($1, $2, $3)
           ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id""",
        uuid.uuid4(), slug, name,
    )


def _content(price, compare_at, active: bool) -> str:
    dump = lambda m: m.model_dump(mode="json") if hasattr(m, "model_dump") else m  # noqa: E731
    return json.dumps({"price": dump(price), "compare_at_price": dump(compare_at) if compare_at else None,
                       "status": "active" if active else "draft"})


async def set_stock(conn, product_id, org_id, quantity: int, reason: str) -> None:
    """Sets what can be sold for a single-variant product (on hand = quantity + reserved)."""
    variants = await conn.fetch("SELECT id FROM product_variant WHERE product_id = $1 AND is_active", product_id)
    if len(variants) != 1:
        raise HTTPException(409, "This product has several variants; set stock per variant")
    variant_id = variants[0]["id"]
    before = await conn.fetchval(
        "SELECT on_hand_quantity FROM inventory_ledger WHERE variant_id = $1 AND organization_id = $2", variant_id, org_id,
    ) or 0
    after = await conn.fetchval(
        """INSERT INTO inventory_ledger (id, variant_id, organization_id, on_hand_quantity, reserved_quantity)
           VALUES ($1, $2, $3, $4, 0)
           ON CONFLICT (variant_id, organization_id) DO UPDATE
           SET on_hand_quantity = $4 + inventory_ledger.reserved_quantity, updated_at = now()
           RETURNING on_hand_quantity""",
        uuid.uuid4(), variant_id, org_id, quantity,
    )
    await conn.execute(
        """INSERT INTO inventory_audit_log (id, variant_id, organization_id, change_quantity, reason)
           VALUES ($1, $2, $3, $4, $5)""",
        uuid.uuid4(), variant_id, org_id, after - before, reason,
    )


async def create_product(conn, org_id, *, title, description, category, images, price, compare_at, stock,
                         active: bool, storefront_keys) -> uuid.UUID:
    """Creates the product, its default variant and stock, and a listing per storefront.
    Returns the first listing id. Run inside a transaction."""
    org = _uuid(org_id)
    stores = await _storefront_ids(conn, storefront_keys)
    product_id = uuid.uuid4()
    slug = f"{re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')[:150] or 'product'}-{product_id.hex[:8]}"
    await conn.execute(
        """INSERT INTO master_product (id, organization_id, category_id, slug, name, description, images, lifecycle_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'ACTIVE')""",
        product_id, org, await _category_id(conn, category), slug, title, description, json.dumps(images),
    )
    await conn.execute("INSERT INTO product_variant (id, product_id, sku) VALUES ($1, $2, 'DEFAULT')", uuid.uuid4(), product_id)
    await set_stock(conn, product_id, org, stock, "product_created")
    first = None
    for key in [str(getattr(k, "value", k)) for k in storefront_keys]:
        listing_id = uuid.uuid4()
        first = first or listing_id
        await conn.execute(
            """INSERT INTO storefront_listing (id, storefront_id, organization_id, product_id, publication_state, listing_content)
               VALUES ($1, $2, $3, $4, $5, $6::json)""",
            listing_id, stores[key], org, product_id, "PUBLISHED" if active else "DRAFT", _content(price, compare_at, active),
        )
    return first


async def update_product(conn, listing, data, add_keys, remove_keys) -> None:
    """Applies a ProductUpdate to every listing of the product. Run inside a transaction."""
    product_id, org = listing["product_id"], listing["organization_id"]
    content_patch = {}
    if data.price is not None:
        content_patch["price"] = data.price.model_dump(mode="json")
    if data.original_price is not None:
        content_patch["compare_at_price"] = data.original_price.model_dump(mode="json")
    if data.is_active is not None:
        content_patch["status"] = "active" if data.is_active else "paused"
    if content_patch or data.is_active is not None:
        await conn.execute(
            """UPDATE storefront_listing
               SET listing_content = (COALESCE(listing_content::jsonb, '{}'::jsonb) || $3::jsonb)::json,
                   publication_state = COALESCE($4, publication_state), updated_at = now()
               WHERE product_id = $1 AND organization_id = $2""",
            product_id, org, json.dumps(content_patch),
            None if data.is_active is None else ("PUBLISHED" if data.is_active else "HIDDEN"),
        )
    if add_keys:
        stores = await _storefront_ids(conn, add_keys)
        for key, store_id in stores.items():
            await conn.execute(
                """INSERT INTO storefront_listing (id, storefront_id, organization_id, product_id, publication_state, listing_content)
                   SELECT $1, $2, organization_id, product_id, publication_state, listing_content
                   FROM storefront_listing WHERE id = $3""",
                uuid.uuid4(), store_id, listing["id"],
            )
    for key in remove_keys:
        await delete_listing(conn, product_id, org, key)
    fields = {k: v for k, v in (("name", data.title), ("description", data.description)) if v is not None}
    if data.category is not None:
        fields["category_id"] = await _category_id(conn, data.category)
    if fields:
        sets = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(fields))
        await conn.execute(f"UPDATE master_product SET {sets}, updated_at = now() WHERE id = $1", product_id, *fields.values())
    if data.stock is not None:
        await set_stock(conn, product_id, org, data.stock, "seller_update")


async def delete_listing(conn, product_id, org_id, storefront_key: str) -> None:
    """Removes a product from a storefront; a listing that was ordered is suspended instead."""
    lid = await conn.fetchval(
        """SELECT l.id FROM storefront_listing l JOIN storefront s ON s.id = l.storefront_id
           WHERE l.product_id = $1 AND l.organization_id = $2 AND s.storefront_key = $3""",
        product_id, org_id, storefront_key,
    )
    if lid:
        await remove_listing(conn, lid)


async def remove_listing(conn, listing_id) -> None:
    try:
        async with conn.transaction():
            await conn.execute("DELETE FROM storefront_listing WHERE id = $1", listing_id)
    except asyncpg.ForeignKeyViolationError:
        await conn.execute(
            """UPDATE storefront_listing SET publication_state = 'SUSPENDED',
               listing_content = (COALESCE(listing_content::jsonb, '{}'::jsonb) || '{"status": "archived"}')::json,
               updated_at = now() WHERE id = $1""",
            listing_id,
        )


async def add_image(conn, product_id, url: str) -> None:
    await conn.execute(
        "UPDATE master_product SET images = images || to_jsonb($2::text), updated_at = now() WHERE id = $1", product_id, url,
    )
