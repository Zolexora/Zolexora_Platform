"""
users/models.py
────────────────
Pydantic models for the Users domain.
"""

from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


class UserProfile(BaseModel):
    """Full user profile — returned to self or admin callers."""
    id: str
    email: str
    name: str
    role: str
    coin_balance: int
    is_active: bool
    is_email_verified: bool
    auth_provider: str
    picture: Optional[str] = None
    created_at: str


class PublicUserProfile(BaseModel):
    """Public user profile — safe to serialize and return to third-party authenticated users."""
    id: str
    name: str
    role: str
    picture: Optional[str] = None
    created_at: str


class UserContacts(BaseModel):
    """Verified contact identifiers for a user account."""
    primary_email: str
    is_email_verified: bool
    verified_emails: List[str] = Field(default_factory=list)
    primary_phone: Optional[str] = None
    is_phone_verified: bool = False
    verified_phones: List[str] = Field(default_factory=list)


class AddressCreate(BaseModel):
    name: str
    phone: str
    address_line: str
    city: str
    state: str
    pincode: str
    is_default: bool = False
    house_no: Optional[str] = None
    village_town: Optional[str] = None
    landmark: Optional[str] = None
    post_office: Optional[str] = None
    district: Optional[str] = None
    division: Optional[str] = None
    region: Optional[str] = None
    country: str = "INDIA"
    postal_delivery_status: Optional[str] = None
    digipin: Optional[str] = None
    address_validation_status: Optional[str] = None
    shipping_serviceability: Optional[str] = None
    email: Optional[EmailStr] = None
    email_otp: Optional[str] = None
    phone_otp: Optional[str] = None


class AddressResponse(AddressCreate):
    id: str
    buyer_id: str
    created_at: str


class AddressEmailOtpRequest(BaseModel):
    email: EmailStr


class EmailOtpVerifyRequest(BaseModel):
    email: EmailStr
    otp: str


class UserProfileDetails(BaseModel):
    """Rich user profile response containing dedicated Contacts and Addresses sections."""
    id: str
    name: str
    role: str
    picture: Optional[str] = None
    coin_balance: int = 0
    created_at: str
    contacts: UserContacts
    addresses: List[AddressResponse] = Field(default_factory=list)
