from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel

class Promotion(BaseModel):
    id: UUID
    organization_id: UUID
    storefront_id: UUID
    code: Optional[str] = None
    type: Literal["PERCENTAGE", "FIXED", "SHIPPING"]
    value: int
    budget_limit: Optional[int] = None
    budget_used: int = 0
    usage_limit: Optional[int] = None
    usage_count: int = 0
    per_user_limit: Optional[int] = None
    minimum_order_value: Optional[int] = None
    is_active: bool = True
    effective_from: datetime
    effective_until: Optional[datetime] = None

class CouponEligibility(BaseModel):
    is_eligible: bool
    discount_amount: int
    message: Optional[str] = None

class PromotionUsage(BaseModel):
    id: UUID
    promotion_id: UUID
    user_id: UUID
    order_id: str
    discount_amount: int
