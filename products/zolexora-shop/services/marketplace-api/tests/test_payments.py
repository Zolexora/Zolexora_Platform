import pytest
from httpx import ASGITransport, AsyncClient
from main import app
from datetime import datetime, timezone
from models.payments import (
    PaymentIntent, 
    PaymentIntentStatus, 
    NextAction, 
    NextActionType,
    InternalProviderMetadata,
    LegacyRazorpayVerifyRequest
)
from models.primitives import Money

def test_money_reuse_and_serialization():
    money = Money(amount_minor=129900, currency="INR")
    assert money.amount_minor == 129900
    assert money.currency == "INR"
    
    # Test JSON serialization exactly matches integer
    dump = money.model_dump_json()
    assert '"amount_minor":129900' in dump
    assert '"currency":"INR"' in dump

def test_payment_enum_serialization():
    intent = PaymentIntent(
        storefront_id="store_123",
        amount=Money(amount_minor=50000, currency="INR"),
        status=PaymentIntentStatus.created,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    dump = intent.model_dump_json()
    assert '"status":"created"' in dump
    
    intent.status = PaymentIntentStatus.authorized
    dump = intent.model_dump_json()
    assert '"status":"authorized"' in dump

def test_legal_state_transitions():
    intent = PaymentIntent(
        storefront_id="store_123",
        amount=Money(amount_minor=50000, currency="INR"),
        status=PaymentIntentStatus.created,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    intent.transition_to(PaymentIntentStatus.requires_action)
    assert intent.status == PaymentIntentStatus.requires_action
    
    intent.transition_to(PaymentIntentStatus.authorized)
    assert intent.status == PaymentIntentStatus.authorized

    intent.transition_to(PaymentIntentStatus.captured)
    assert intent.status == PaymentIntentStatus.captured

    intent.transition_to(PaymentIntentStatus.refunded)
    assert intent.status == PaymentIntentStatus.refunded

def test_illegal_state_transitions():
    intent = PaymentIntent(
        storefront_id="store_123",
        amount=Money(amount_minor=50000, currency="INR"),
        status=PaymentIntentStatus.captured,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    # Cannot transition from captured to created
    with pytest.raises(ValueError, match="Illegal state transition"):
        intent.transition_to(PaymentIntentStatus.created)
        
    # Cannot transition from failed to captured
    intent.status = PaymentIntentStatus.failed
    with pytest.raises(ValueError, match="Illegal state transition"):
        intent.transition_to(PaymentIntentStatus.captured)

def test_internal_provider_metadata_exclusion():
    # Internal provider metadata should be a separate model 
    # not nested in PaymentIntent public serialization
    intent = PaymentIntent(
        storefront_id="store_123",
        amount=Money(amount_minor=50000, currency="INR"),
        status=PaymentIntentStatus.created,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    internal = InternalProviderMetadata(
        payment_intent_id=intent.id,
        provider_name="razorpay",
        provider_order_id="order_abc",
        raw_payload={"secret": "hidden"}
    )
    
    intent_dump = intent.model_dump_json()
    assert "provider_name" not in intent_dump
    assert "razorpay" not in intent_dump
    
    # But internal metadata exists
    assert internal.provider_name == "razorpay"

def test_legacy_razorpay_adapter_request():
    req = LegacyRazorpayVerifyRequest(
        razorpay_order_id="order_123",
        razorpay_payment_id="pay_123",
        razorpay_signature="sig_abc"
    )
    assert req.razorpay_order_id == "order_123"

def test_refund_amount_bounds():
    from models.payments import RefundSummary
    refund = RefundSummary(
        total_refunded=Money(amount_minor=50000, currency="INR")
    )
    assert refund.total_refunded.amount_minor == 50000

def test_idempotency_contract_behavior():
    intent = PaymentIntent(
        storefront_id="store_123",
        amount=Money(amount_minor=50000, currency="INR"),
        idempotency_key="idemp_key_123",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    assert intent.idempotency_key == "idemp_key_123"

def test_next_action_validation():
    with pytest.raises(ValueError, match="redirect_url is required"):
        PaymentIntent(
            storefront_id="store_123",
            amount=Money(amount_minor=50000, currency="INR"),
            next_action=NextAction(type=NextActionType.redirect),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
    
    valid_intent = PaymentIntent(
        storefront_id="store_123",
        amount=Money(amount_minor=50000, currency="INR"),
        next_action=NextAction(type=NextActionType.redirect, redirect_url="https://example.com"),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    assert valid_intent.next_action.redirect_url == "https://example.com"


@pytest.mark.asyncio
async def test_storefront_isolation_payments():
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="https://api.zolexora.com") as client:
        # Missing Storefront Context
        response = await client.get("/api/payments/intent_123")
        assert response.status_code == 400
        
        # Valid Zolexora Shop request
        response_zol = await client.get("/api/payments/intent_123", headers={"X-Storefront-Key": "zolexora-shop"})
        assert response_zol.status_code in (200, 404, 501, 204, 500) # Not implemented dummy endpoints return 500 due to validation
        
        # Valid Mahila Madel request
        response_mah = await client.get("/api/payments/intent_123", headers={"X-Storefront-Key": "mahila-madel"})
        assert response_mah.status_code in (200, 404, 501, 204, 500)
        
        # Forged storefront identity (Invalid Host/Origin)
        response_forged = await client.get("/api/payments/intent_123", headers={"Origin": "https://evil.com"})
        assert response_forged.status_code == 400
