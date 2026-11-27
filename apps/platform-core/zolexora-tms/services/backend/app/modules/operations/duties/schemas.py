import datetime
import uuid
import enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

class DutyStatus(str, enum.Enum):
    UNASSIGNED = "UNASSIGNED"
    ASSIGNED = "ASSIGNED"
    DRIVER_ACCEPTANCE_PENDING = "DRIVER_ACCEPTANCE_PENDING"
    ACCEPTED = "ACCEPTED"
    DISPATCHED = "DISPATCHED"
    ARRIVED_PICKUP = "ARRIVED_PICKUP"
    IN_TRANSIT = "IN_TRANSIT"
    ARRIVED_DROP = "ARRIVED_DROP"
    DUTY_COMPLETED = "DUTY_COMPLETED"
    CANCELLED = "CANCELLED"

class DutyAssignmentStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"

class DutyBase(BaseModel):
    booking_id: uuid.UUID
    scheduled_start_time: datetime.datetime
    scheduled_end_time: datetime.datetime
    notes: Optional[str] = None

class DutyCreate(DutyBase):
    driver_id: Optional[uuid.UUID] = None
    vehicle_id: Optional[uuid.UUID] = None

class DutyAssignRequest(BaseModel):
    driver_id: uuid.UUID
    vehicle_id: uuid.UUID

class DutyReassignRequest(BaseModel):
    driver_id: Optional[uuid.UUID] = None
    vehicle_id: Optional[uuid.UUID] = None
    reason: str = Field(..., min_length=3)

class DriverActionRequest(BaseModel):
    reason: Optional[str] = None

class DutyAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    duty_id: uuid.UUID
    driver_id: uuid.UUID
    vehicle_id: uuid.UUID
    assigned_by_user_id: uuid.UUID
    status: DutyAssignmentStatus
    assigned_at: datetime.datetime
    accepted_at: Optional[datetime.datetime] = None
    rejected_at: Optional[datetime.datetime] = None
    rejection_reason: Optional[str] = None

class DutyBookingSummary(BaseModel):
    id: uuid.UUID
    booking_number: str
    booking_type: Optional[str] = None
    service_type: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    passenger_name: Optional[str] = None
    passenger_phone: Optional[str] = None
    passenger_count: Optional[int] = None
    shift_label: Optional[str] = None
    pickup_address: str
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    drop_address: str
    drop_lat: Optional[float] = None
    drop_lng: Optional[float] = None
    pickup_datetime: datetime.datetime
    cargo_description: Optional[str] = None
    cargo_weight_kg: Optional[float] = None
    special_instructions: Optional[str] = None
    eway_bill_number: Optional[str] = None
    eway_bill_valid_until: Optional[datetime.datetime] = None
    stops: List[Dict[str, Any]] = Field(default_factory=list)
    boarding_pin: Optional[str] = None
    escort_required: bool = False
    escort_guard_name: Optional[str] = None
    safe_drop_confirmed_at: Optional[datetime.datetime] = None


class DutyStopUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(ARRIVED|BOARDED|DROPPED|NO_SHOW|DELIVERED)$")
    pin: Optional[str] = Field(None, max_length=8)
    pod_url: Optional[str] = None
    notes: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)


class EscortVerifyRequest(BaseModel):
    escort_guard_name: str = Field(..., min_length=2, max_length=128)


class SafeDropConfirmRequest(BaseModel):
    pin: Optional[str] = Field(None, max_length=8)
    notes: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)


class DutyVehicleSummary(BaseModel):
    id: uuid.UUID
    registration_number: str
    make: Optional[str] = None
    model: Optional[str] = None
    fuel_type: Optional[str] = None
    odometer_km: Optional[float] = None
    vendor_id: Optional[uuid.UUID] = None


class DutyDriverSummary(BaseModel):
    id: uuid.UUID
    full_name: str
    phone: str
    vendor_id: Optional[uuid.UUID] = None


class DutyTripSummary(BaseModel):
    id: uuid.UUID
    trip_number: str
    status: str
    start_odometer: float
    end_odometer: Optional[float] = None
    toll_amount: float = 0.0
    fuel_amount: float = 0.0
    parking_amount: float = 0.0
    waiting_minutes: int = 0
    pod_attachment_url: Optional[str] = None
    pod_notes: Optional[str] = None
    operational_receipts: List[Dict[str, Any]] = Field(default_factory=list)


class DutyResponse(DutyBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    duty_number: str
    organisation_id: uuid.UUID
    driver_id: Optional[uuid.UUID] = None
    vehicle_id: Optional[uuid.UUID] = None
    start_time: Optional[datetime.datetime] = None
    end_time: Optional[datetime.datetime] = None
    start_km: Optional[float] = None
    end_km: Optional[float] = None
    status: DutyStatus
    booking: Optional[DutyBookingSummary] = None
    vehicle: Optional[DutyVehicleSummary] = None
    driver: Optional[DutyDriverSummary] = None
    trip: Optional[DutyTripSummary] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

