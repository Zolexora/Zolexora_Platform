from typing import Generic, TypeVar, Optional, List, Annotated
from datetime import datetime, timezone
from pydantic import Field, StringConstraints, field_validator, StrictInt
from pydantic.functional_validators import AfterValidator
from .base import APIModel

T = TypeVar('T')
MAX_SAFE_INTEGER = 9_007_199_254_740_991

def _normalize_to_utc(v: datetime) -> datetime:
    if getattr(v, "tzinfo", None) is None or v.utcoffset() is None:
        raise ValueError("Datetime must be timezone-aware")
    return v.astimezone(timezone.utc)

# A strictly timezone-aware timestamp that serializes to ISO 8601 UTC
UTCDateTime = Annotated[datetime, AfterValidator(_normalize_to_utc), Field(description="ISO 8601 UTC timestamp")]

# Bounded, non-empty opaque string for external APIs.
EntityId = Annotated[str, StringConstraints(min_length=1, max_length=64)]

class Money(APIModel):
    """
    Canonical money format for the marketplace.
    Backend calculations may use Decimal, but public JSON contracts use integers.
    amount_minor is the amount in the minor unit of the currency (e.g. cents, paise).
    """
    amount_minor: StrictInt = Field(..., ge=0, le=MAX_SAFE_INTEGER, description="Amount in minor units (e.g. 129900 for 1299.00)")
    currency: str = Field(..., min_length=3, max_length=3, pattern="^[A-Z]{3}$", description="ISO 4217 Currency Code")

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        if not v.isupper():
            raise ValueError("currency must be an uppercase 3-letter code")
        return v

class PageCursor(APIModel):
    """Pagination request by cursor."""
    cursor: Optional[str] = None
    limit: int = Field(default=20, ge=1, le=100)

class PageResultMeta(APIModel):
    """Pagination metadata for cursor-based responses."""
    next_cursor: Optional[str] = None
    has_more: bool

class PaginatedResponse(APIModel, Generic[T]):
    """Generic paginated response envelope."""
    items: List[T]
    meta: PageResultMeta
