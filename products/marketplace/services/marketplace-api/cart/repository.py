import uuid

import asyncpg


class PostgresCartRepository:
    def __init__(self, connection: asyncpg.Connection):
        self.connection = connection

    async def get_active_cart(
        self,
        storefront_id: uuid.UUID,
        buyer_id: uuid.UUID | None = None,
        anonymous_key: str | None = None,
    ) -> dict | None:
        if buyer_id:
            query = """
                SELECT id, storefront_id, buyer_id, anonymous_key, currency, status, expires_at, created_at, updated_at
                FROM shopping_cart
                WHERE storefront_id = $1 AND buyer_id = $2 AND status = 'active'
            """
            row = await self.connection.fetchrow(query, storefront_id, buyer_id)
        elif anonymous_key:
            query = """
                SELECT id, storefront_id, buyer_id, anonymous_key, currency, status, expires_at, created_at, updated_at
                FROM shopping_cart
                WHERE storefront_id = $1 AND anonymous_key = $2 AND status = 'active'
            """
            row = await self.connection.fetchrow(query, storefront_id, anonymous_key)
        else:
            return None

        return dict(row) if row else None
        
    async def get_cart_by_id(self, cart_id: uuid.UUID) -> dict | None:
        row = await self.connection.fetchrow(
            """
            SELECT id, storefront_id, buyer_id, anonymous_key, currency, status, expires_at, created_at, updated_at
            FROM shopping_cart
            WHERE id = $1
            """,
            cart_id
        )
        return dict(row) if row else None

    async def create_cart(
        self,
        storefront_id: uuid.UUID,
        currency: str,
        buyer_id: uuid.UUID | None = None,
        anonymous_key: str | None = None,
    ) -> dict:
        row = await self.connection.fetchrow(
            """
            INSERT INTO shopping_cart (storefront_id, buyer_id, anonymous_key, currency)
            VALUES ($1, $2, $3, $4)
            RETURNING id, storefront_id, buyer_id, anonymous_key, currency, status, expires_at, created_at, updated_at
            """,
            storefront_id, buyer_id, anonymous_key, currency
        )
        return dict(row) # type: ignore

    async def get_cart_items(self, cart_id: uuid.UUID) -> list[dict]:
        rows = await self.connection.fetch(
            """
            SELECT id, cart_id, storefront_listing_id, quantity, created_at, updated_at
            FROM shopping_cart_item
            WHERE cart_id = $1
            """,
            cart_id
        )
        return [dict(row) for row in rows]

    async def get_listing(self, storefront_listing_id: uuid.UUID) -> dict | None:
        row = await self.connection.fetchrow(
            """
            SELECT id, storefront_id, publication_state
            FROM storefront_listing
            WHERE id = $1
            """,
            storefront_listing_id
        )
        return dict(row) if row else None

    async def add_or_update_cart_item(
        self,
        cart_id: uuid.UUID,
        storefront_listing_id: uuid.UUID,
        quantity_delta: int,
        is_absolute: bool = False
    ) -> dict:
        if is_absolute:
            row = await self.connection.fetchrow(
                """
                INSERT INTO shopping_cart_item (cart_id, storefront_listing_id, quantity)
                VALUES ($1, $2, $3)
                ON CONFLICT (cart_id, storefront_listing_id)
                DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now()
                RETURNING id, cart_id, storefront_listing_id, quantity, created_at, updated_at
                """,
                cart_id, storefront_listing_id, quantity_delta
            )
        else:
            row = await self.connection.fetchrow(
                """
                INSERT INTO shopping_cart_item (cart_id, storefront_listing_id, quantity)
                VALUES ($1, $2, $3)
                ON CONFLICT (cart_id, storefront_listing_id)
                DO UPDATE SET quantity = shopping_cart_item.quantity + EXCLUDED.quantity, updated_at = now()
                RETURNING id, cart_id, storefront_listing_id, quantity, created_at, updated_at
                """,
                cart_id, storefront_listing_id, quantity_delta
            )
        return dict(row) # type: ignore

    async def remove_cart_item(self, cart_id: uuid.UUID, storefront_listing_id: uuid.UUID) -> bool:
        result = await self.connection.execute(
            """
            DELETE FROM shopping_cart_item
            WHERE cart_id = $1 AND storefront_listing_id = $2
            """,
            cart_id, storefront_listing_id
        )
        return result != "DELETE 0"
        
    async def clear_cart(self, cart_id: uuid.UUID) -> None:
        await self.connection.execute("DELETE FROM shopping_cart_item WHERE cart_id = $1", cart_id)
        
    async def deactivate_cart(self, cart_id: uuid.UUID, status: str = 'abandoned') -> None:
        await self.connection.execute("UPDATE shopping_cart SET status = $2 WHERE id = $1", cart_id, status)
