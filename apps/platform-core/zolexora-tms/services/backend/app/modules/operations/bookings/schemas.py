import datetime
import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.modules.operations.bookings.enums import BookingStatus, BookingServiceType, BookingType


class BookingStop(BaseModel):
    seq: int = Field(..., ge=1)
    stop_type: str = Field(default="PICKUP", description="PICKUP | DROP")
    address: str = Field(..., min_length=3)
    lat: Optional[float] = None
    lng: Optional[float] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    employee_id: Optional[str] = None
    boarding_pin: Optional[str] = Field(None, max_length=8)
    status: str = Field(default="PENDING", description="PENDING | ARRIVED | BOARDED | DROPPED | NO_SHOW | DELIVERED")
    arrived_at: Optional[datetime.datetime] = None
    boarded_at: Optional[datetime.datetime] = None
    dropped_at: Optional[datetime.datetime] = None
    delivered_at: Optional[datetime.datetime] = None
    pod_url: Optional[str] = None
    notes: Optional[str] = None


class BookingBase(BaseModel):
    customer_id: uuid.UUID
    booking_request_id: Optional[uuid.UUID] = None
    booking_type: str = Field(default="SPOT", min_length=1, max_length=64)
    service_type: BookingServiceType = Field(default=BookingServiceType.CARGO)
    pickup_address: str = Field(..., min_length=3)
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    drop_address: str = Field(..., min_length=3)
    drop_lat: Optional[float] = None
    drop_lng: Optional[float] = None
    pickup_datetime: datetime.datetime
    expected_completion_datetime: Optional[datetime.datetime] = None
    passenger_info: Dict[str, Any] = Field(default_factory=dict)
    cargo_info: Dict[str, Any] = Field(default_factory=dict)
    vehicle_requirements: Dict[str, Any] = Field(default_factory=dict)
    driver_requirements: Dict[str, Any] = Field(default_factory=dict)
    commercial_terms: Dict[str, Any] = Field(default_factory=dict)
    operational_instructions: Optional[str] = None
    eway_bill_number: Optional[str] = Field(None, max_length=32)
    eway_bill_valid_until: Optional[datetime.datetime] = None
    stops: List[BookingStop] = Field(default_factory=list)
    boarding_pin: Optional[str] = Field(None, max_length=8)
    escort_required: Optional[bool] = None
    escort_guard_name: Optional[str] = Field(None, max_length=128)
    source: str = Field(default="MANUAL")

class BookingCreate(BookingBase):
    pass

class BookingUpdate(BaseModel):
    pickup_address: Optional[str] = None
    drop_address: Optional[str] = None
    pickup_datetime: Optional[datetime.datetime] = None
    expected_completion_datetime: Optional[datetime.datetime] = None
    passenger_info: Optional[Dict[str, Any]] = None
    cargo_info: Optional[Dict[str, Any]] = None
    vehicle_requirements: Optional[Dict[str, Any]] = None
    driver_requirements: Optional[Dict[str, Any]] = None
    operational_instructions: Optional[str] = None
    eway_bill_number: Optional[str] = Field(None, max_length=32)
    eway_bill_valid_until: Optional[datetime.datetime] = None
    stops: Optional[List[BookingStop]] = None
    status: Optional[BookingStatus] = None

class BookingResponse(BookingBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    booking_number: str
    organisation_id: uuid.UUID
    status: BookingStatus
    metadata_: Dict[str, Any] = Field(default_factory=dict, alias="metadata_")
    safe_drop_confirmed_at: Optional[datetime.datetime] = None
    created_by_user_id: Optional[uuid.UUID] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime


class EwayBillUpdateRequest(BaseModel):
    eway_bill_number: str = Field(..., min_length=12, max_length=32, description="12-digit GST NIC e-Way Bill number")
    eway_bill_valid_until: datetime.datetime


class EwayBillCheckResponse(BaseModel):
    checked_count: int
    expiring_soon_count: int
    expired_count: int
    alerts: list[Dict[str, Any]] = Field(default_factory=list)


class BookingBulkItemError(BaseModel):
    row: int
    reference: Optional[str] = None
    error: str


class BookingBulkCreateRequest(BaseModel):
    bookings: list[Dict[str, Any]] = Field(..., min_length=1, max_length=5000)


class BookingBulkCreateResponse(BaseModel):
    created_count: int
    failed_count: int
    created: list[BookingResponse]
    errors: list[BookingBulkItemError]
