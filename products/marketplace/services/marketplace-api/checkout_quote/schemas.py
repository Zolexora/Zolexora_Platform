import uuid
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

class ShoppingCartItem(BaseModel):
    variant_id: uuid.UUID
    organization_id: uuid.UUID
    quantity: int = Field(..., gt=0)
    client_total_minor: Optional[int] = None # Should be ignored

class CheckoutQuoteCreate(BaseModel):
    cart_id: uuid.UUID

class QuoteLineItem(BaseModel):
    variant_id: uuid.UUID
    organization_id: uuid.UUID
    quantity: int
    unit_price_minor: int
    tax_minor: int
    discount_minor: int
    total_minor: int

class QuotePromotion(BaseModel):
    promotion_id: uuid.UUID
    discount_minor: int

class CheckoutQuoteResponse(BaseModel):
    id: uuid.UUID
    storefront_id: uuid.UUID
    buyer_id: Optional[uuid.UUID]
    anonymous_key: Optional[str]
    cart_id: Optional[uuid.UUID]
    status: str
    currency: str
    subtotal_minor: int
    tax_minor: int
    shipping_minor: int
    discount_minor: int
    total_minor: int
    expires_at: Optional[datetime]
    quote_signature: Optional[str]
    lines: List[QuoteLineItem] = Field(default_factory=list)
    promotions: List[QuotePromotion] = Field(default_factory=list)
