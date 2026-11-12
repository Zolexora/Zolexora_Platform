"""A real PostgreSQL commerce world for cart, checkout and order tests (rolled back after each).

Two buyers, two seller organisations with approved grants on both storefronts; tests add
listings with seed_listing(). Ids are fixed so tests can name them.
"""

import json
import uuid

import asyncpg
import pytest

from tests.pg import ensure_database

BUYER_1 = "00000000-0000-4000-8000-0000000000b1"
BUYER_2 = "00000000-0000-4000-8000-0000000000b2"
SEL_1 = "00000000-0000-4000-8000-0000000000c1"
SEL_2 = "00000000-0000-4000-8000-0000000000c2"
SEL_3 = "00000000-0000-4000-8000-0000000000c3"
PROD_1 = "00000000-0000-4000-8000-0000000000a1"
PROD_2 = "00000000-0000-4000-8000-0000000000a2"
PROD_3 = "00000000-0000-4000-8000-0000000000a3"
SELLER_NAMES = {SEL_1: "Seller One", SEL_2: "Seller Two", SEL_3: "Seller Three"}


@pytest.fixture
async def pg():
    conn = await asyncpg.connect(ensure_database())
    tx = conn.transaction()
    await tx.start()
    try:
        for key, name in (("zolexora-shop", "Zolexora Shop"), ("mahila-madel", "Mahila Madel")):
            await conn.execute(
                """INSERT INTO storefront (id, storefront_key, display_name, currency, locale)
                   VALUES ($1, $2, $3, 'INR', 'en-IN') ON CONFLICT (storefront_key) DO NOTHING""",
                uuid.uuid4(), key, name,
            )
        for buyer in (BUYER_1, BUYER_2):
            await conn.execute("INSERT INTO users (id, email, full_name) VALUES ($1, $2, 'Buyer')", uuid.UUID(buyer), f"{buyer}@example.com")
            await conn.execute("INSERT INTO user_profile (id, user_id, name) VALUES (gen_random_uuid(), $1, 'Buyer')", uuid.UUID(buyer))
        for org, name in SELLER_NAMES.items():
            await conn.execute("INSERT INTO seller_organization (id, name, slug, status) VALUES ($1, $2, $3, 'ACTIVE')",
                               uuid.UUID(org), name, name.lower().replace(" ", "-"))
            await conn.execute(
                """INSERT INTO seller_storefront_grant (id, organization_id, storefront_id, grant_status)
                   SELECT gen_random_uuid(), $1, id, 'APPROVED' FROM storefront""",
                uuid.UUID(org),
            )
        yield conn
    finally:
        await tx.rollback()
        await conn.close()


async def seed_listing(pg, listing_id: str, *, org: str = SEL_1, storefront: str = "zolexora-shop", price: int = 1000,
                       stock: int = 100, title: str = "Product", images=(), published: bool = True) -> None:
    product_id = uuid.uuid5(uuid.NAMESPACE_URL, listing_id)
    await pg.execute(
        """INSERT INTO master_product (id, organization_id, slug, name, description, images, lifecycle_status)
           VALUES ($1, $2, $3, $4, '', $5::jsonb, 'ACTIVE') ON CONFLICT (id) DO NOTHING""",
        product_id, uuid.UUID(org), f"p-{product_id.hex}", title, json.dumps(list(images)),
    )
    variant = await pg.fetchval(
        """INSERT INTO product_variant (id, product_id, sku) VALUES ($1, $2, 'DEFAULT')
           ON CONFLICT (product_id, sku) DO UPDATE SET sku = EXCLUDED.sku RETURNING id""",
        uuid.uuid4(), product_id,
    )
    await pg.execute(
        """INSERT INTO inventory_ledger (id, variant_id, organization_id, on_hand_quantity) VALUES ($1, $2, $3, $4)
           ON CONFLICT (variant_id, organization_id) DO UPDATE SET on_hand_quantity = EXCLUDED.on_hand_quantity""",
        uuid.uuid4(), variant, uuid.UUID(org), stock,
    )
    await pg.execute(
        """INSERT INTO storefront_listing (id, storefront_id, organization_id, product_id, publication_state, listing_content)
           SELECT $1, s.id, $2, $3, $4, $5::json FROM storefront s WHERE s.storefront_key = $6""",
        uuid.UUID(listing_id), uuid.UUID(org), product_id, "PUBLISHED" if published else "DRAFT",
        json.dumps({"price": {"amount_minor": price, "currency": "INR"}, "status": "active"}), storefront,
    )


async def stock_of(pg, listing_id: str) -> tuple[int, int]:
    """(on hand, reserved) for a listing's default variant."""
    row = await pg.fetchrow(
        """SELECT il.on_hand_quantity, il.reserved_quantity FROM storefront_listing l
           JOIN product_variant v ON v.product_id = l.product_id
           JOIN inventory_ledger il ON il.variant_id = v.id AND il.organization_id = l.organization_id
           WHERE l.id = $1""",
        uuid.UUID(listing_id),
    )
    return row["on_hand_quantity"], row["reserved_quantity"]


async def record_quote(pg, token: str, buyer_id: str, storefront: str = "zolexora-shop") -> None:
    """Registers a quote a test signed itself, as POST /cart/checkout/quote would."""
    await pg.execute(
        """INSERT INTO checkout_quote (id, storefront_id, buyer_id, status, currency, quote_signature)
           SELECT gen_random_uuid(), id, $1, 'READY', 'INR', $2 FROM storefront WHERE storefront_key = $3""",
        uuid.UUID(buyer_id), token.rsplit(".", 1)[1], storefront,
    )


ORDER_1 = "00000000-0000-4000-8000-0000000000d1"
ORDER_2 = "00000000-0000-4000-8000-0000000000d2"
ORDER_3 = "00000000-0000-4000-8000-0000000000d3"


async def seed_order(pg, order_id: str, *, buyer: str = BUYER_1, org: str = SEL_1, storefront: str = "zolexora-shop",
                     total: int = 1000, **fields) -> dict:
    """A placed one-line order (its listing is created when missing); fields override the document."""
    from commerce import orders as order_store

    listing = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{org}:{storefront}"))
    if not await pg.fetchval("SELECT 1 FROM storefront_listing WHERE id = $1", uuid.UUID(listing)):
        await seed_listing(pg, listing, org=org, storefront=storefront, price=total)
    money = {"amount_minor": total, "currency": "INR"}
    doc = {"id": order_id, "order_number": f"ORD-{order_id[-6:]}", "storefront_id": storefront, "buyer_id": buyer,
           "seller_id": org, "status": "placed", "payment_status": "pending", "currency": "INR",
           "lines": [{"product_id": listing, "product_title": "Product", "seller_id": org, "quantity": 1,
                      "unit_price": money, "subtotal": money}],
           "item_subtotal": money, "grand_total": money, "shipping_address": {}, **fields}
    await order_store.insert(pg, doc)
    return doc


async def seed_shipment(pg, order_id: str, **fields) -> dict:
    """The order's courier shipment (the order must exist); fields override the document."""
    from shipping import store

    shipment = await store.get_or_create(pg, await _order(pg, order_id))
    if fields:
        await store.update(pg, shipment["id"], fields)
    return await store.get(pg, id=shipment["id"])


async def _order(pg, order_id: str) -> dict:
    from commerce import orders as order_store
    return await order_store.get(pg, id=order_id)
