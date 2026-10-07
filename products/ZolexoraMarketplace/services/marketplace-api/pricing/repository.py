import uuid
import asyncpg

class PostgresPricingRepository:
    def __init__(self, connection: asyncpg.Connection):
        self.connection = connection

    async def get_active_price(
        self,
        *,
        storefront_id: uuid.UUID,
        variant_id: uuid.UUID,
    ) -> dict | None:
        row = await self.connection.fetchrow(
            """
            SELECT pr.id, pr.price_book_id, pr.variant_id, pr.amount, pr.compare_at_amount,
                   pr.effective_from, pr.effective_until, pb.currency
            FROM price_book pb
            JOIN price_record pr ON pb.id = pr.price_book_id
            WHERE pb.storefront_id = $1
              AND pb.is_active = true
              AND pr.variant_id = $2
              AND pr.effective_from <= now()
              AND (pr.effective_until IS NULL OR pr.effective_until > now())
            ORDER BY pr.effective_from DESC
            LIMIT 1
            """,
            storefront_id, variant_id
        )
        return dict(row) if row else None
