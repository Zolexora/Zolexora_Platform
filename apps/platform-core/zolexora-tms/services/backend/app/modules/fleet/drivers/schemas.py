import datetime
import re
import uuid
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.modules.fleet.drivers.models import DriverType, DriverStatus


def _validate_pan(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    cleaned = v.strip().upper()
    if not cleaned:
        return None
    if not re.fullmatch(r"[A-Z]{5}[0-9]{4}[A-Z]", cleaned):
        raise ValueError("PAN must be 10 characters (e.g. AAAPA1234A)")
    return cleaned


def _validate_aadhaar_last4(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    cleaned = v.strip()
    if not cleaned:
        return None
    if not re.fullmatch(r"\d{4}", cleaned):
        raise ValueError("Aadhaar last 4 must be 4 digits")
    return cleaned


class DriverBase(BaseModel):
    vendor_id: Optional[uuid.UUID] = None
    full_name: str = Field(..., min_length=2, max_length=160)
    phone: str = Field(..., min_length=7, max_length=32)
    alternate_phone: Optional[str] = Field(None, max_length=32)
    email: Optional[str] = Field(None, max_length=160)
    license_number: str = Field(..., min_length=4, max_length=64)
    license_type: str = Field(default="HMV", max_length=64)
    license_expiry: Optional[datetime.date] = None
    badge_number: Optional[str] = Field(None, max_length=64)
    aadhaar_last4: Optional[str] = Field(None, max_length=4)
    pan: Optional[str] = Field(None, max_length=10)
    driver_type: DriverType = Field(default=DriverType.PERMANENT)
    avatar_url: Optional[str] = None
    documents: dict = Field(default_factory=dict)

    @field_validator("pan")
    @classmethod
    def check_pan(cls, v: Optional[str]) -> Optional[str]:
        return _validate_pan(v)

    @field_validator("aadhaar_last4")
    @classmethod
    def check_aadhaar(cls, v: Optional[str]) -> Optional[str]:
        return _validate_aadhaar_last4(v)


class DriverCreate(DriverBase):
    vendor_code: Optional[str] = Field(None, max_length=32)


class DriverUpdate(BaseModel):
    vendor_id: Optional[uuid.UUID] = None
    vendor_code: Optional[str] = Field(None, max_length=32)
    full_name: Optional[str] = Field(None, min_length=2, max_length=160)
    phone: Optional[str] = Field(None, min_length=7, max_length=32)
    alternate_phone: Optional[str] = Field(None, max_length=32)
    email: Optional[str] = Field(None, max_length=160)
    license_number: Optional[str] = Field(None, min_length=4, max_length=64)
    license_type: Optional[str] = Field(None, max_length=64)
    license_expiry: Optional[datetime.date] = None
    badge_number: Optional[str] = Field(None, max_length=64)
    aadhaar_last4: Optional[str] = Field(None, max_length=4)
    pan: Optional[str] = Field(None, max_length=10)
    driver_type: Optional[DriverType] = None
    status: Optional[DriverStatus] = None
    avatar_url: Optional[str] = None
    documents: Optional[dict] = None

    @field_validator("pan")
    @classmethod
    def check_pan(cls, v: Optional[str]) -> Optional[str]:
        return _validate_pan(v)

    @field_validator("aadhaar_last4")
    @classmethod
    def check_aadhaar(cls, v: Optional[str]) -> Optional[str]:
        return _validate_aadhaar_last4(v)


class DriverResponse(DriverBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organisation_id: uuid.UUID
    driver_code: Optional[str] = None
    vendor_code: Optional[str] = None
    vendor_name: Optional[str] = None
    vendor_pan: Optional[str] = None
    status: DriverStatus
    created_at: datetime.datetime
    updated_at: datetime.datetime


class DriverBulkItemError(BaseModel):
    row: int
    full_name: Optional[str] = None
    error: str


class DriverBulkCreateRequest(BaseModel):
    drivers: list[dict[str, Any]] = Field(..., min_length=1, max_length=5000)


class DriverBulkCreateResponse(BaseModel):
    created_count: int
    failed_count: int
    created: list[DriverResponse]
    errors: list[DriverBulkItemError]
