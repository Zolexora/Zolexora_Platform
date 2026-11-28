"""Unit tests for auto-invoice generation on trip completion and passenger push notifications."""
from __future__ import annotations

import datetime
import uuid
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.passenger_notify import _dispatch_external, _resolve_passenger_push_tokens
from app.core.push import send_passenger_boarding_pin_push
from app.modules.finance.billing.enums import BillingStatus, RateRuleType
from app.modules.finance.billing.models import BillingRecord, FinancialSnapshot, FinancialSnapshotLine, RateCardRule, RateCardVersion
from app.modules.finance.billing.engine import FinancialEngine
from app.modules.finance.invoices.enums import InvoiceStatus
from app.modules.finance.invoices.routes import auto_generate_trip_invoice, build_invoice_from_records


@pytest.mark.asyncio
async def test_build_invoice_from_records_aggregates_and_marks_invoiced():
    org_id = uuid.uuid4()
    customer_id = uuid.uuid4()
    user_id = uuid.uuid4()
    rec_id = uuid.uuid4()

    snap = FinancialSnapshot(
        id=uuid.uuid4(),
        organisation_id=org_id,
        subtotal=Decimal("2500.00"),
        discount_amount=Decimal("100.00"),
        surcharge_amount=Decimal("0.00"),
        taxable_amount=Decimal("2400.00"),
        tax_amount=Decimal("120.00"),
        grand_total=Decimal("2520.00"),
        currency="INR",
        is_finalized=False,
        lines=[
            FinancialSnapshotLine(
                description="Base Trip Package",
                rule_type=RateRuleType.FIXED_TRIP.value,
                quantity=Decimal("1.00"),
                unit="Fixed",
                unit_rate=Decimal("2500.00"),
                amount=Decimal("2500.00"),
                is_tax=False,
            ),
            FinancialSnapshotLine(
                description="GST 5%",
                rule_type=RateRuleType.TAX_IGST.value,
                quantity=Decimal("1.00"),
                unit="%",
                unit_rate=Decimal("5.00"),
                amount=Decimal("120.00"),
                is_tax=True,
            ),
        ],
    )
    record = BillingRecord(
        id=rec_id,
        organisation_id=org_id,
        customer_id=customer_id,
        duty_id=uuid.uuid4(),
        status=BillingStatus.PENDING,
        snapshot_id=snap.id,
        snapshot=snap,
    )

    db = MagicMock()
    db.add = MagicMock()
    db.flush = AsyncMock()

    today = datetime.date.today()
    invoice = await build_invoice_from_records(
        db,
        organisation_id=org_id,
        customer_id=customer_id,
        records=[record],
        invoice_date=today,
        due_date=today + datetime.timedelta(days=14),
        created_by_user_id=user_id,
        notes="Auto-generated",
    )

    assert invoice.status == InvoiceStatus.DRAFT
    assert invoice.subtotal == Decimal("2500.00")
    assert invoice.discount_amount == Decimal("100.00")
    assert invoice.taxable_amount == Decimal("2400.00")
    assert invoice.tax_amount == Decimal("120.00")
    assert invoice.grand_total == Decimal("2520.00")
    assert invoice.amount_due == Decimal("2520.00")
    assert len(invoice.lines) == 1
    assert invoice.lines[0].description == "Base Trip Package"
    assert record.status == BillingStatus.INVOICED
    assert record.invoice_id == invoice.id


@pytest.mark.asyncio
async def test_financial_engine_operational_inputs_json_serializable():
    import json

    duty = SimpleNamespace(id=uuid.uuid4(), organisation_id=uuid.uuid4(), booking_id=uuid.uuid4())
    trip = SimpleNamespace(
        id=uuid.uuid4(),
        total_distance_km=Decimal("42.5"),
        start_odometer=Decimal("1000"),
        end_odometer=Decimal("1042.5"),
        start_timestamp=datetime.datetime(2026, 11, 28, 8, 0, tzinfo=datetime.timezone.utc),
        end_timestamp=datetime.datetime(2026, 11, 28, 9, 30, tzinfo=datetime.timezone.utc),
        waiting_minutes=15,
        toll_amount=Decimal("120.00"),
        parking_amount=Decimal("40.00"),
        fuel_amount=Decimal("0.00"),
    )
    rule = RateCardRule(
        id=uuid.uuid4(),
        rate_card_version_id=uuid.uuid4(),
        rule_type=RateRuleType.FIXED_TRIP,
        name="City Drop",
        base_amount=Decimal("1500.00"),
        quantity_included=Decimal("0"),
        rate_per_unit=Decimal("0"),
        is_percentage=False,
        percentage_value=Decimal("0"),
        sequence=1,
        conditions={},
    )
    version = SimpleNamespace(id=uuid.uuid4(), rules=[rule])

    db = MagicMock()
    db.add = MagicMock()
    db.flush = AsyncMock()

    snapshot = await FinancialEngine.calculate_snapshot(db, duty, trip, version, uuid.uuid4())
    # Must serialize cleanly to JSON without Decimal TypeError for Postgres JSONB
    serialized = json.dumps(snapshot.operational_inputs)
    assert "42.5" in serialized
    assert snapshot.grand_total == Decimal("1500.00")


@pytest.mark.asyncio
async def test_auto_generate_trip_invoice_skips_when_already_billed():
    db = MagicMock()
    existing_result = MagicMock()
    existing_result.scalar_one_or_none.return_value = uuid.uuid4()
    db.execute = AsyncMock(return_value=existing_result)
    db.commit = AsyncMock()

    duty = SimpleNamespace(id=uuid.uuid4(), booking_id=uuid.uuid4())
    trip = SimpleNamespace(id=uuid.uuid4(), trip_number="TR-2026-0001")

    await auto_generate_trip_invoice(db, uuid.uuid4(), duty, trip, uuid.uuid4())
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_passenger_boarding_pin_push_formats_payload():
    with patch("app.core.push.send_expo_push", new_callable=AsyncMock) as mock_send:
        await send_passenger_boarding_pin_push(
            token="ExponentPushToken[abc123]",
            duty_number="DT-001",
            duty_id="duty-1",
            boarding_pin="4829",
            stage="DISPATCHED",
            tracking_url="https://track.zolexora.com/t/xyz",
        )
        mock_send.assert_awaited_once()
        kwargs = mock_send.call_args.kwargs
        assert kwargs["token"] == "ExponentPushToken[abc123]"
        assert "4829" in kwargs["body"]
        assert kwargs["data"]["screen"] == "passenger-trip"
        assert kwargs["data"]["duty_id"] == "duty-1"


@pytest.mark.asyncio
async def test_resolve_and_dispatch_passenger_push_dedupes_tokens():
    db = MagicMock()
    exec_res = MagicMock()
    exec_res.all.return_value = [
        ("+91 98765 43210", "ExponentPushToken[pax1]"),
        ("9999999999", "ExponentPushToken[other]"),
    ]
    db.execute = AsyncMock(return_value=exec_res)

    recipients = [
        {"phone": "9876543210", "boarding_pin": "1234", "message": "hi"},
        {"phone": "+919876543210", "boarding_pin": "1234", "message": "hi2"},
    ]
    tokens = await _resolve_passenger_push_tokens(db, recipients)
    assert tokens == {"919876543210": ["ExponentPushToken[pax1]"]}

    with patch("app.core.passenger_notify.send_passenger_boarding_pin_push", new_callable=AsyncMock) as mock_push:
        await _dispatch_external(
            payload={"duty_id": "d1", "stage": "DISPATCHED", "tracking_url": "https://track.zolexora.com/t/abc"},
            recipients=recipients,
            duty_number="DT-100",
            push_tokens_by_digits=tokens,
        )
        mock_push.assert_awaited_once()
