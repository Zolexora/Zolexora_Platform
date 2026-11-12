import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class InventoryLedgerBase(BaseModel):
    variant_id: uuid.UUID
    organization_id: uuid.UUID
    on_hand_quantity: int = Field(ge=0)
    reserved_quantity: int = Field(ge=0)
    status: str


class InventoryLedger(InventoryLedgerBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdjustInventoryRequest(BaseModel):
    amount: int
    reason: str
    reference_id: str | None = None


class ReserveInventoryRequest(BaseModel):
    quantity: int = Field(gt=0)
    expires_at: datetime
    reference_id: str | None = None


class InventoryReservation(BaseModel):
    id: uuid.UUID
    variant_id: uuid.UUID
    organization_id: uuid.UUID
    quantity: int
    status: str
    expires_at: datetime
    reference_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryAuditLog(BaseModel):
    id: uuid.UUID
    variant_id: uuid.UUID
    organization_id: uuid.UUID
    change_quantity: int
    reason: str
    reference_id: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
