import uuid
from datetime import datetime
from models.base import APIModel

class PriceBook(APIModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    storefront_id: uuid.UUID
    name: str
    currency: str
    is_active: bool

class PriceRecord(APIModel):
    id: uuid.UUID
    price_book_id: uuid.UUID
    variant_id: uuid.UUID
    amount: int
    compare_at_amount: int | None = None
    effective_from: datetime
    effective_until: datetime | None = None

class PriceSnapshot(APIModel):
    amount: int
    currency: str
    price_book_id: uuid.UUID
