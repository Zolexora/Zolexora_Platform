import re
import uuid
from typing import Any, Optional, List
from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import datetime
from decimal import Decimal


def _validate_gstin_or_aadhaar(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    cleaned = v.strip().upper()
    if not cleaned:
        return None
    if not (re.fullmatch(r"\d{12}", cleaned) or re.fullmatch(r"[A-Z0-9]{15}", cleaned)):
        raise ValueError("Must be a 12-digit Aadhaar number or a 15-character GSTIN")
    return cleaned


def _validate_pan(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    cleaned = v.strip().upper()
    if not cleaned:
        return None
    if not re.fullmatch(r"[A-Z]{5}[0-9]{4}[A-Z]", cleaned):
        raise ValueError("PAN must be 10 characters (e.g. AAACT2727Q)")
    return cleaned


class ClientBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=160)
    contact_person: Optional[str] = Field(None, max_length=120)
    email: Optional[str] = Field(None, max_length=160)
    phone: Optional[str] = Field(None, max_length=32)
    billing_address: Optional[str] = None
    gstin: Optional[str] = Field(None, max_length=15)
    pan: Optional[str] = Field(None, max_length=10)
    payment_terms_days: Optional[int] = 30
    credit_limit: Optional[Decimal] = Decimal('0.0')
    status: Optional[str] = "ACTIVE"
    is_zolexora_user: bool = False
    zolexora_org_id: Optional[str] = Field(None, max_length=64)
    notes: Optional[str] = None

    @field_validator("gstin")
    @classmethod
    def check_gstin(cls, v: Optional[str]) -> Optional[str]:
        return _validate_gstin_or_aadhaar(v)

    @field_validator("pan")
    @classmethod
    def check_pan(cls, v: Optional[str]) -> Optional[str]:
        return _validate_pan(v)


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=160)
    contact_person: Optional[str] = Field(None, max_length=120)
    email: Optional[str] = Field(None, max_length=160)
    phone: Optional[str] = Field(None, max_length=32)
    billing_address: Optional[str] = None
    gstin: Optional[str] = Field(None, max_length=15)
    pan: Optional[str] = Field(None, max_length=10)
    payment_terms_days: Optional[int] = None
    credit_limit: Optional[Decimal] = None
    status: Optional[str] = None
    is_zolexora_user: Optional[bool] = None
    zolexora_org_id: Optional[str] = Field(None, max_length=64)
    notes: Optional[str] = None

    @field_validator("gstin")
    @classmethod
    def check_gstin(cls, v: Optional[str]) -> Optional[str]:
        return _validate_gstin_or_aadhaar(v)

    @field_validator("pan")
    @classmethod
    def check_pan(cls, v: Optional[str]) -> Optional[str]:
        return _validate_pan(v)


class ClientResponse(ClientBase):
    id: uuid.UUID
    organisation_id: uuid.UUID
    client_code: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class ClientBulkItemError(BaseModel):
    row: int
    name: Optional[str] = None
    error: str


class ClientBulkCreateRequest(BaseModel):
    clients: list[dict[str, Any]] = Field(..., min_length=1, max_length=5000)


class ClientBulkCreateResponse(BaseModel):
    created_count: int
    failed_count: int
    created: list[ClientResponse]
    errors: list[ClientBulkItemError]

class ClientLocationBase(BaseModel):
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    status: Optional[str] = "ACTIVE"
    operating_unit_id: Optional[uuid.UUID] = None

class ClientLocationCreate(ClientLocationBase):
    pass

class ClientLocationUpdate(ClientLocationBase):
    name: Optional[str] = None

class ClientLocationResponse(ClientLocationBase):
    id: uuid.UUID
    client_id: uuid.UUID
    organisation_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class ClientOURelationshipRequest(BaseModel):
    operating_unit_id: uuid.UUID
    status: Optional[str] = "ACTIVE"

class ClientOURelationshipResponse(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    operating_unit_id: uuid.UUID
    status: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class ClientLocationTransferRequest(BaseModel):
    new_operating_unit_id: uuid.UUID
    reason: Optional[str] = None

class ClientLocationOUHistoryResponse(BaseModel):
    id: uuid.UUID
    client_location_id: uuid.UUID
    previous_operating_unit_id: Optional[uuid.UUID]
    new_operating_unit_id: Optional[uuid.UUID]
    actor_id: Optional[uuid.UUID]
    reason: Optional[str]
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
