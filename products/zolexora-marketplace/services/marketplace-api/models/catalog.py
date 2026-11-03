from typing import Optional, List
from .base import APIModel
from .primitives import Money


# A product as the API returns it: one storefront listing of a PostgreSQL catalog product.
class ProductListingResponse(APIModel):
    id: str
    storefront_id: str
    storefront_ids: Optional[List[str]] = None
    seller_id: str
    seller_name: str
    title: str
    description: str
    price: Money
    original_price: Optional[Money] = None
    discount_percent: Optional[float] = None
    category: str
    images: List[str]
    stock: int
    is_active: bool
    rating: float
    reviews_count: int
    created_at: str
