from uuid import UUID
from pydantic import BaseModel
from typing import Any, Dict, Optional

class WebhookReceiptCreate(BaseModel):
    storefront_id: UUID
    provider: str
    external_event_id: str
    status: str
    payload: Dict[str, Any]
    signature: Optional[str]

class TransactionLedgerCreate(BaseModel):
    payment_record_id: UUID
    type: str
    amount_minor: int
    currency: str
