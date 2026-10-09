import uuid
from datetime import datetime, timezone
from asyncpg import Connection

from .repository import PromotionRepository

class PromotionService:
    def __init__(self, connection: Connection):
        self.repo = PromotionRepository(connection)
        self.conn = connection
        
    async def apply_promotion(
        self,
        code: str,
        storefront_id: uuid.UUID,
        order_subtotal: int,
        user_id: uuid.UUID,
        order_id: str
    ) -> dict:
        async with self.conn.transaction():
            promo = await self.repo.get_promotion_by_code(code, storefront_id, for_update=True)
            
            if not promo:
                raise ValueError("Promotion not found for this storefront")
                
            if not promo['is_active']:
                raise ValueError("Promotion is not active")
                
            now = datetime.now(timezone.utc)
            if promo['effective_from'] > now:
                raise ValueError("Promotion is not yet effective")
                
            if promo['effective_until'] and promo['effective_until'] < now:
                raise ValueError("Promotion has expired")
                
            if promo['minimum_order_value'] and order_subtotal < promo['minimum_order_value']:
                raise ValueError("Order subtotal does not meet the minimum requirement")
                
            if promo['usage_limit'] and promo['usage_count'] >= promo['usage_limit']:
                raise ValueError("Promotion usage limit reached")
                
            if promo['per_user_limit']:
                user_usage = await self.repo.get_usage_count_for_user(promo['id'], user_id)
                if user_usage >= promo['per_user_limit']:
                    raise ValueError("Per-user usage limit reached")
                    
            discount_amount = 0
            if promo['type'] == 'PERCENTAGE':
                discount_amount = int(order_subtotal * (promo['value'] / 100.0))
            elif promo['type'] == 'FIXED':
                discount_amount = promo['value']
            elif promo['type'] == 'SHIPPING':
                discount_amount = promo['value']
                
            discount_amount = min(discount_amount, order_subtotal)
            
            if promo['budget_limit']:
                if promo['budget_used'] >= promo['budget_limit']:
                    raise ValueError("Promotion budget limit reached")
                
                remaining_budget = promo['budget_limit'] - promo['budget_used']
                discount_amount = min(discount_amount, remaining_budget)
            
            if discount_amount <= 0:
                raise ValueError("Discount amount is zero")
                
            usage_id = await self.repo.record_usage(
                promo['id'],
                user_id,
                order_id,
                discount_amount
            )
            
            return {
                "promotion_id": promo['id'],
                "discount_amount": discount_amount,
                "usage_id": usage_id
            }
