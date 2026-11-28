import datetime
import re
import uuid
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.modules.crm.vendors.models import VendorType, VendorStatus


def _validate_gstin_or_aadhaar(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    cleaned = v.strip().upper()
    if not cleaned:
        return None
    if not (re.fullmatch(r"\d{12}", cleaned) or re.fullmatch(r"[A-Z0-9]{15}", cleaned)):
        raise ValueError("Must be a 12-digit Aadhaar number or a 15-character GSTIN")
    return cleaned


class VendorBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=160)
    vendor_type: VendorType = Field(default=VendorType.FLEET_SUPPLIER)
    contact_person: Optional[str] = Field(None, max_length=120)
    email: Optional[str] = Field(None, max_length=160)
    phone: Optional[str] = Field(None, max_length=32)
    address: Optional[str] = None
    gstin: Optional[str] = Field(None, max_length=15)
    pan: Optional[str] = Field(None, max_length=10)
    bank_account_name: Optional[str] = Field(None, max_length=120)
    bank_account_number: Optional[str] = Field(None, max_length=64)
    bank_ifsc: Optional[str] = Field(None, max_length=20)
    bank_name: Optional[str] = Field(None, max_length=120)

    @field_validator("gstin")
    @classmethod
    def check_gstin(cls, v: Optional[str]) -> Optional[str]:
        return _validate_gstin_or_aadhaar(v)


class VendorCreate(VendorBase):
    pass


class VendorUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=160)
    vendor_type: Optional[VendorType] = None
    contact_person: Optional[str] = Field(None, max_length=120)
    email: Optional[str] = Field(None, max_length=160)
    phone: Optional[str] = Field(None, max_length=32)
    address: Optional[str] = None
    gstin: Optional[str] = Field(None, max_length=15)
    pan: Optional[str] = Field(None, max_length=10)
    bank_account_name: Optional[str] = Field(None, max_length=120)
    bank_account_number: Optional[str] = Field(None, max_length=64)
    bank_ifsc: Optional[str] = Field(None, max_length=20)
    bank_name: Optional[str] = Field(None, max_length=120)
    status: Optional[VendorStatus] = None

    @field_validator("gstin")
    @classmethod
    def check_gstin(cls, v: Optional[str]) -> Optional[str]:
        return _validate_gstin_or_aadhaar(v)


class VendorResponse(VendorBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organisation_id: uuid.UUID
    vendor_code: Optional[str] = None
    status: VendorStatus
    created_at: datetime.datetime
    updated_at: datetime.datetime


class VendorBulkItemError(BaseModel):
    row: int
    name: Optional[str] = None
    error: str


class VendorBulkCreateRequest(BaseModel):
    vendors: list[dict[str, Any]] = Field(..., min_length=1, max_length=500)


class VendorBulkCreateResponse(BaseModel):
    created_count: int
    failed_count: int
    created: list[VendorResponse]
    errors: list[VendorBulkItemError]
