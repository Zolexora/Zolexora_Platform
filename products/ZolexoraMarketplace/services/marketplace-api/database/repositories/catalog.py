import uuid

import asyncpg


class PostgresCatalogRepository:
    """Scoped catalog persistence; the caller owns commit/rollback."""

    def __init__(self, connection: asyncpg.Connection):
        self.connection = connection

    async def get_seller_listing(
        self,
        *,
        storefront_id: uuid.UUID,
        seller_id: uuid.UUID,
        listing_id: uuid.UUID,
    ) -> dict | None:
        row = await self.connection.fetchrow(
            """
            SELECT id, storefront_id, seller_id, product_id, price_minor, currency, status
            FROM listing
            WHERE storefront_id = $1 AND seller_id = $2 AND id = $3
            """,
            storefront_id, seller_id, listing_id,
        )
        return dict(row) if row else None

    async def list_seller_listings(
        self,
        *,
        storefront_id: uuid.UUID,
        seller_id: uuid.UUID,
        limit: int,
        offset: int,
    ) -> list[dict]:
        rows = await self.connection.fetch(
            """
            SELECT id, storefront_id, seller_id, product_id, price_minor, currency, status
            FROM listing
            WHERE storefront_id = $1 AND seller_id = $2
            ORDER BY created_at, id
            LIMIT $3 OFFSET $4
            """,
            storefront_id, seller_id, limit, offset,
        )
        return [dict(row) for row in rows]

    async def set_owned_inventory(
        self,
        *,
        storefront_id: uuid.UUID,
        seller_id: uuid.UUID,
        listing_id: uuid.UUID,
        quantity: int,
    ) -> dict | None:
        row = await self.connection.fetchrow(
            """
            UPDATE inventory_balance AS inventory
            SET on_hand_quantity = $4
            FROM listing
            WHERE listing.id = $3
              AND listing.storefront_id = $1
              AND listing.seller_id = $2
              AND inventory.product_id = listing.product_id
              AND inventory.seller_id = listing.seller_id
            RETURNING inventory.id, inventory.product_id, inventory.seller_id,
                      inventory.on_hand_quantity, inventory.reserved_quantity,
                      inventory.available_quantity
            """,
            storefront_id, seller_id, listing_id, quantity,
        )
        return dict(row) if row else None
