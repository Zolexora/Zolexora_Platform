"""The buyer's cart in PostgreSQL: one active shopping_cart per buyer and storefront, a line
per storefront listing. Prices and stock always come from the catalog when it is read."""

import uuid

from fastapi import HTTPException


def _uuid(value) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError) as exc:
        raise HTTPException(404, "Product not found or belongs to a different storefront") from exc


async def cart_id(conn, buyer_id, storefront_key: str, create: bool = False) -> uuid.UUID | None:
    found = await conn.fetchval(
        """SELECT c.id FROM shopping_cart c JOIN storefront s ON s.id = c.storefront_id
           WHERE c.buyer_id = $1 AND s.storefront_key = $2 AND c.status = 'active'""",
        uuid.UUID(str(buyer_id)), storefront_key,
    )
    if found or not create:
        return found
    return await conn.fetchval(
        """INSERT INTO shopping_cart (id, storefront_id, buyer_id, currency)
           SELECT $1, s.id, $2, s.currency FROM storefront s WHERE s.storefront_key = $3
           ON CONFLICT (storefront_id, buyer_id) WHERE status = 'active' AND buyer_id IS NOT NULL
           DO UPDATE SET updated_at = now()
           RETURNING id""",
        uuid.uuid4(), uuid.UUID(str(buyer_id)), storefront_key,
    )


async def items(conn, buyer_id, storefront_key: str) -> list[tuple[str, int]]:
    rows = await conn.fetch(
        """SELECT i.storefront_listing_id::text AS listing_id, i.quantity
           FROM shopping_cart_item i JOIN shopping_cart c ON c.id = i.cart_id JOIN storefront s ON s.id = c.storefront_id
           WHERE c.buyer_id = $1 AND s.storefront_key = $2 AND c.status = 'active'
           ORDER BY i.created_at, i.id""",
        uuid.UUID(str(buyer_id)), storefront_key,
    )
    return [(r["listing_id"], r["quantity"]) for r in rows]


async def quantity(conn, buyer_id, storefront_key: str, listing_id) -> int:
    return dict(await items(conn, buyer_id, storefront_key)).get(str(_uuid(listing_id)), 0)


async def set_quantity(conn, buyer_id, storefront_key: str, listing_id, qty: int) -> None:
    cid = await cart_id(conn, buyer_id, storefront_key, create=True)
    await conn.execute(
        """INSERT INTO shopping_cart_item (id, cart_id, storefront_listing_id, quantity) VALUES ($1, $2, $3, $4)
           ON CONFLICT (cart_id, storefront_listing_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now()""",
        uuid.uuid4(), cid, _uuid(listing_id), qty,
    )


async def remove(conn, buyer_id, storefront_key: str, listing_id=None) -> None:
    """Removes one line, or every line when listing_id is None."""
    cid = await cart_id(conn, buyer_id, storefront_key)
    if cid:
        await conn.execute(
            "DELETE FROM shopping_cart_item WHERE cart_id = $1 AND ($2::uuid IS NULL OR storefront_listing_id = $2)",
            cid, None if listing_id is None else _uuid(listing_id),
        )


async def convert(conn, buyer_id, storefront_key: str) -> None:
    """The cart became orders; the buyer's next cart starts empty."""
    await conn.execute(
        """UPDATE shopping_cart c SET status = 'converted', updated_at = now() FROM storefront s
           WHERE s.id = c.storefront_id AND c.buyer_id = $1 AND s.storefront_key = $2 AND c.status = 'active'""",
        uuid.UUID(str(buyer_id)), storefront_key,
    )
