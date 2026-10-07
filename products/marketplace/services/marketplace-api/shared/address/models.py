from typing import List, Optional
from pydantic import BaseModel, Field


class PostOfficeInfo(BaseModel):
    """Structured postal office information resolved from a postal index number."""
    name: str
    delivery_status: str = "Delivery"  # "Delivery" or "Non-Delivery"
    circle: Optional[str] = None
    district: Optional[str] = None
    division: Optional[str] = None
    region: Optional[str] = None
    state: Optional[str] = None
    country: str = "INDIA"


class PincodeResult(BaseModel):
    """Normalized postal geography metadata derived from an Indian Pincode."""
    pincode: str
    country: str = "INDIA"
    state: str
    region: str
    division: str
    district: str
    post_offices: List[PostOfficeInfo] = Field(default_factory=list)
    postal_delivery_status: str = "DELIVERY AVAILABLE"  # "DELIVERY AVAILABLE" or "DELIVERY NOT AVAILABLE"


class ShippingServiceabilityResult(BaseModel):
    """Marketplace courier and logistics serviceability assessment."""
    serviceable: bool = True
    provider: str = "SHIPWAY"
    estimated_delivery_days: Optional[int] = 3
    cod_available: bool = True
    message: Optional[str] = "Serviceable by Courier Partner"


class DigipinAccuracyResult(BaseModel):
    """DIGIPIN digital postal index grid assessment."""
    valid: bool = True
    digipin: Optional[str] = None
    region: Optional[str] = None
    accuracy_score: float = 1.0
    message: Optional[str] = "DIGIPIN verified with postal grid"


class AddressValidationResult(BaseModel):
    """Google Address Validation or external validation engine assessment."""
    status: str = "VALID"  # UNVALIDATED, VALIDATING, VALID, PARTIALLY_VALID, CORRECTION_REQUIRED, INVALID, PROVIDER_UNAVAILABLE
    provider: str = "GOOGLE"
    is_complete: bool = True
    message: Optional[str] = "Address verified"
