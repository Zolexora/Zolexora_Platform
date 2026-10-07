from typing import Optional, List
from pydantic import Field, StrictInt
from .base import APIModel
from .primitives import MAX_SAFE_INTEGER, EntityId, Money
from storefronts.models import StorefrontKey
import uuid
from datetime import datetime, timezone

def now_iso(): return datetime.now(timezone.utc).isoformat()
def new_id():  return str(uuid.uuid4())

class MasterProductDoc(APIModel):
    id: EntityId = Field(default_factory=new_id)
    seller_id: EntityId
    seller_name: str
    title: str
    description: str
    category: str = "Other"
    brand: Optional[str] = None
    images: List[str] = Field(default_factory=list)
    is_active: bool = True
    created_at: str = Field(default_factory=now_iso)

class StorefrontListingDoc(APIModel):
    id: EntityId = Field(default_factory=new_id)
    storefront_id: StorefrontKey
    product_id: EntityId
    seller_id: EntityId
    price: Money
    compare_at_price: Optional[Money] = None
    status: str = "draft"
    
    # Storefront-specific overrides
    title_override: Optional[str] = None
    description_override: Optional[str] = None
    images_override: Optional[List[str]] = None

    rating: float = 0.0
    reviews_count: int = 0
    created_at: str = Field(default_factory=now_iso)

class InventoryBalanceDoc(APIModel):
    id: EntityId = Field(default_factory=new_id)
    product_id: EntityId
    seller_id: EntityId
    available_quantity: StrictInt = Field(ge=0, le=MAX_SAFE_INTEGER)
    reserved_quantity: StrictInt = Field(default=0, ge=0, le=MAX_SAFE_INTEGER)
    updated_at: str = Field(default_factory=now_iso)

# We define a joined response for the frontend for now, or just return the listing.
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
