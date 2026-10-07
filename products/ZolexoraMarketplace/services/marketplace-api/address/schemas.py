from typing import Optional, Literal
from uuid import UUID
from pydantic import Field
from models.base import APIModel
from models.primitives import UTCDateTime

AddressType = Literal["BILLING", "SHIPPING"]

class CustomerAddressBase(APIModel):
    address_type: AddressType
    is_default: bool = False
    country_code: str = Field(..., min_length=2, max_length=2)
    region: Optional[str] = Field(None, max_length=128)
    city: str = Field(..., max_length=128)
    postal_code: str = Field(..., max_length=32)
    line1: str = Field(..., max_length=256)
    line2: Optional[str] = Field(None, max_length=256)
    recipient_name: str = Field(..., max_length=200)
    phone_number: Optional[str] = Field(None, max_length=32)

class CustomerAddressCreate(CustomerAddressBase):
    pass

class CustomerAddressUpdate(APIModel):
    address_type: Optional[AddressType] = None
    is_default: Optional[bool] = None
    country_code: Optional[str] = Field(None, min_length=2, max_length=2)
    region: Optional[str] = Field(None, max_length=128)
    city: Optional[str] = Field(None, max_length=128)
    postal_code: Optional[str] = Field(None, max_length=32)
    line1: Optional[str] = Field(None, max_length=256)
    line2: Optional[str] = Field(None, max_length=256)
    recipient_name: Optional[str] = Field(None, max_length=200)
    phone_number: Optional[str] = Field(None, max_length=32)

class CustomerAddressResponse(CustomerAddressBase):
    id: UUID
    user_id: UUID
    created_at: UTCDateTime
    updated_at: UTCDateTime
