import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

def now_iso(): return datetime.now(timezone.utc).isoformat()
def new_id(): return str(uuid.uuid4())


# ── Pickup Location ───────────────────────────────────────────────────────────
class PickupLocationCreate(BaseModel):
    label: str
    contact_name: str
    phone: str
    email: str
    address_line_1: str
    address_line_2: str = ""
    city: str
    state: str
    pincode: str
    country: str = "India"
    gst_number: str = ""
    is_default: bool = False


class PickupLocationDoc(BaseModel):
    id: str = Field(default_factory=new_id)
    seller_id: str
    label: str
    contact_name: str
    phone: str
    email: str
    address_line_1: str
    address_line_2: str = ""
    city: str
    state: str
    pincode: str
    country: str = "India"
    gst_number: str = ""
    is_default: bool = False
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


# ── Shipment ──────────────────────────────────────────────────────────────────
class ShipmentStatus:
    PENDING            = "pending"
    DISCOVERING        = "discovering_options"
    OPTIONS_FOUND      = "options_found"
    BOOKING            = "booking"
    BOOKED             = "booked"
    PICKUP_REQUESTED   = "pickup_requested"
    IN_TRANSIT         = "in_transit"
    OUT_FOR_DELIVERY   = "out_for_delivery"
    DELIVERED          = "delivered"
    CANCELLED          = "cancelled"
    FAILED             = "booking_failed"
    ATTENTION_REQUIRED = "shipping_attention_required"


class PackageDetails(BaseModel):
    weight_kg: float            # in kilograms
    length_cm: float            # in centimetres
    breadth_cm: float
    height_cm: float


class ShipmentDoc(BaseModel):
    id: str = Field(default_factory=new_id)
    order_id: str
    seller_id: str
    buyer_id: str

    # Addresses
    pickup_location_id: Optional[str] = None
    pickup_pincode: str = ""
    delivery_pincode: str = ""
    delivery_name: str = ""
    delivery_phone: str = ""
    delivery_address: str = ""
    delivery_city: str = ""
    delivery_state: str = ""

    # Package
    package_weight: float = 0.5
    length: float = 10.0
    breadth: float = 10.0
    height: float = 10.0
    declared_value: float = 0.0
    cod_amount: float = 0.0

    # Courier decision
    selected_provider: Optional[str] = None
    selected_courier_name: Optional[str] = None
    selected_service_code: Optional[str] = None
    awb: Optional[str] = None
    label_url: Optional[str] = None
    tracking_url: Optional[str] = None
    shipping_cost: Optional[float] = None
    estimated_delivery_days: Optional[int] = None

    # Status
    current_status: str = ShipmentStatus.PENDING
    is_auto_booked: bool = False
    auto_booking_attempted_at: Optional[str] = None
    shipping_attention_required: bool = False
    failure_reason: Optional[str] = None

    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


# ── Shipment Option ───────────────────────────────────────────────────────────
class ShipmentOptionDoc(BaseModel):
    id: str = Field(default_factory=new_id)
    shipment_id: str
    provider: str
    courier_name: str
    serviceable: bool = False
    estimated_cost: Optional[float] = None
    estimated_delivery_days: Optional[int] = None
    cod_supported: bool = False
    booking_supported: bool = True
    ranking_position: Optional[int] = None
    rejected_reason: Optional[str] = None
    raw_payload: Dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(default_factory=now_iso)


# ── Booking Attempt ───────────────────────────────────────────────────────────
class BookingAttemptDoc(BaseModel):
    id: str = Field(default_factory=new_id)
    shipment_id: str
    provider: str
    attempt_number: int
    request_payload: Dict[str, Any] = Field(default_factory=dict)
    response_payload: Dict[str, Any] = Field(default_factory=dict)
    success: bool = False
    error_message: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


# ── Tracking Event ────────────────────────────────────────────────────────────
class TrackingEventDoc(BaseModel):
    id: str = Field(default_factory=new_id)
    shipment_id: str
    provider: str
    awb: str
    status: str
    status_code: Optional[str] = None
    description: str = ""
    location: str = ""
    event_time: str = Field(default_factory=now_iso)
    raw_payload: Dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(default_factory=now_iso)


# ── Provider-facing abstractions ──────────────────────────────────────────────
class CourierOption(BaseModel):
    """Normalised courier option returned by each provider."""
    provider: str
    courier_name: str
    service_code: str
    serviceable: bool
    estimated_cost: Optional[float] = None
    estimated_delivery_days: Optional[int] = None
    cod_supported: bool = False
    booking_supported: bool = True
    rejected_reason: Optional[str] = None
    raw_payload: Dict[str, Any] = Field(default_factory=dict)


class BookingResult(BaseModel):
    success: bool
    awb: Optional[str] = None
    label_url: Optional[str] = None
    tracking_url: Optional[str] = None
    shipping_cost: Optional[float] = None
    error_message: Optional[str] = None
    raw_response: Dict[str, Any] = Field(default_factory=dict)


class TrackingResult(BaseModel):
    awb: str
    current_status: str
    events: List[Dict[str, Any]] = Field(default_factory=list)
    raw_response: Dict[str, Any] = Field(default_factory=dict)


# ── API Request / Response schemas ────────────────────────────────────────────
class ManualBookRequest(BaseModel):
    provider: str
    service_code: str
    courier_name: str


class DiscoverOptionsRequest(BaseModel):
    pickup_location_id: Optional[str] = None
    package_weight: float = 0.5
    length_cm: float = 10.0
    breadth_cm: float = 10.0
    height_cm: float = 10.0
    declared_value: Optional[float] = None
