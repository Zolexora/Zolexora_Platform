from datetime import datetime, timezone
import pytest
from pydantic import BaseModel, ValidationError
from models.primitives import Money, UTCDateTime, EntityId
from models.errors import ErrorResponse, ErrorDetail

def test_money_canonical_format():
    money = Money(amount_minor=129900, currency="INR")
    assert money.amount_minor == 129900
    assert money.currency == "INR"
    assert money.model_dump() == {"amount_minor": 129900, "currency": "INR"}

def test_money_rejects_lowercase_currency():
    with pytest.raises(ValidationError):
        Money(amount_minor=100, currency="inr")

def test_money_rejects_floats_if_strict():
    # Reject floats
    with pytest.raises(ValidationError):
        Money(amount_minor=100.0, currency="INR")
    with pytest.raises(ValidationError):
        Money(amount_minor=1.0, currency="INR")
        
    # Reject strings
    with pytest.raises(ValidationError):
        Money(amount_minor="100", currency="INR")

    # Reject booleans (StrictInt prevents this)
    with pytest.raises(ValidationError):
        Money(amount_minor=True, currency="INR")

    # Reject negative
    with pytest.raises(ValidationError):
        Money(amount_minor=-1, currency="INR")

    # Reject above JS MAX_SAFE_INTEGER
    with pytest.raises(ValidationError):
        Money(amount_minor=9007199254740992, currency="INR")

    # Accept boundaries
    assert Money(amount_minor=0, currency="INR").amount_minor == 0
    assert Money(amount_minor=9007199254740991, currency="INR").amount_minor == 9007199254740991

class DummyModel(BaseModel):
    created_at: UTCDateTime
    entity_id: EntityId

def test_utc_datetime():
    dt = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    model = DummyModel(created_at=dt, entity_id="12345")
    assert model.created_at == dt
    # test validation
    with pytest.raises(ValidationError):
        DummyModel(created_at="not a date", entity_id="123")

def test_utcdatetime_rejects_naive():
    naive_dt = datetime(2026, 1, 1, 12, 0, 0) # naive
    with pytest.raises(ValidationError, match="Datetime must be timezone-aware"):
        DummyModel(created_at=naive_dt, entity_id="123")

    # ISO string without timezone should be parsed as naive by pydantic and then fail our validator
    with pytest.raises(ValidationError, match="Datetime must be timezone-aware"):
        DummyModel(created_at="2026-07-31T12:00:00", entity_id="123")

def test_utcdatetime_normalizes_to_utc():
    from datetime import timedelta
    # Create an aware datetime in UTC+5:30 (IST)
    ist = timezone(timedelta(hours=5, minutes=30))
    ist_dt = datetime(2026, 1, 1, 17, 30, 0, tzinfo=ist)
    model = DummyModel(created_at=ist_dt, entity_id="123")
    
    # It should be normalized to UTC (12:00:00 UTC)
    assert model.created_at.tzinfo == timezone.utc
    assert model.created_at.hour == 12

def test_entity_id():
    with pytest.raises(ValidationError):
        DummyModel(created_at=datetime.now(timezone.utc), entity_id="")
    
    with pytest.raises(ValidationError):
        DummyModel(created_at=datetime.now(timezone.utc), entity_id="a" * 65)

def test_error_envelope():
    err = ErrorResponse(
        error=ErrorDetail(code="validation_error", message="Invalid input")
    )
    assert err.error.code == "validation_error"
    assert err.error.message == "Invalid input"
    assert err.error.details == []
