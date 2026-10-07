import uuid
from typing import Optional

from asyncpg import Connection


class PromotionRepository:
    def __init__(self, connection: Connection):
        self.conn = connection

    async def get_promotion_by_code(
        self, code: str, storefront_id: uuid.UUID, for_update: bool = False
    ) -> Optional[dict]:
        query = """
            SELECT *
            FROM promotion
            WHERE code = $1 AND storefront_id = $2
        """
        if for_update:
            query += " FOR UPDATE"
        
        row = await self.conn.fetchrow(query, code, storefront_id)
        if not row:
            return None
        return dict(row)

    async def get_usage_count_for_user(self, promotion_id: uuid.UUID, user_id: uuid.UUID) -> int:
        query = """
            SELECT COUNT(*)
            FROM promotion_usage
            WHERE promotion_id = $1 AND user_id = $2
        """
        return await self.conn.fetchval(query, promotion_id, user_id)

    async def record_usage(
        self,
        promotion_id: uuid.UUID,
        user_id: uuid.UUID,
        order_id: str,
        discount_amount: int
    ) -> uuid.UUID:
        usage_id = uuid.uuid4()
        query = """
            INSERT INTO promotion_usage (id, promotion_id, user_id, order_id, discount_amount)
            VALUES ($1, $2, $3, $4, $5)
        """
        await self.conn.execute(query, usage_id, promotion_id, user_id, order_id, discount_amount)
        
        update_promo_query = """
            UPDATE promotion
            SET budget_used = budget_used + $1, usage_count = usage_count + 1
            WHERE id = $2
        """
        await self.conn.execute(update_promo_query, discount_amount, promotion_id)
        
        return usage_id
