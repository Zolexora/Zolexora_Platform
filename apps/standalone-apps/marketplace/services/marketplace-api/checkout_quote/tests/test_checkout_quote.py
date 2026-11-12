import pytest
import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock

from checkout_quote.schemas import CheckoutQuoteCreate
from checkout_quote.service import CheckoutQuoteService, StaleQuoteError

@pytest.fixture
def mock_dependencies():
    return {
        "cart_repo": AsyncMock(),
        "pricing_svc": AsyncMock(),
        "inventory_svc": AsyncMock(),
        "tax_svc": AsyncMock(),
        "promo_svc": AsyncMock(),
        "quote_repo": AsyncMock(),
    }

@pytest.fixture
def quote_service(mock_dependencies):
    return CheckoutQuoteService(**mock_dependencies)

@pytest.mark.asyncio
async def test_quote_creation_ignores_client_totals(quote_service, mock_dependencies):
    cart_id = uuid.uuid4()
    storefront_id = uuid.uuid4()
    buyer_id = uuid.uuid4()
    variant_id = uuid.uuid4()
    org_id = uuid.uuid4()

    # Mock Cart
    mock_dependencies["cart_repo"].get_cart_items.return_value = [
        {"variant_id": variant_id, "organization_id": org_id, "quantity": 2, "client_total_minor": 100} # client total should be ignored
    ]
    mock_dependencies["cart_repo"].get_cart.return_value = {
        "storefront_id": storefront_id,
        "buyer_id": buyer_id,
        "currency": "USD"
    }

    # Mock Pricing - Server says 150 each
    mock_dependencies["pricing_svc"].get_active_price.return_value = {"amount": 150, "currency": "USD"}

    # Mock Inventory
    mock_dependencies["inventory_svc"].check_availability.return_value = True

    # Mock Tax
    mock_dependencies["tax_svc"].calculate_tax.return_value = 30 # For total 300

    # Mock Promo
    mock_dependencies["promo_svc"].apply_promotions.return_value = {"discount_minor": 0, "applied_promos": []}

    # Mock DB Save
    mock_dependencies["quote_repo"].create_quote.return_value = uuid.uuid4()

    req = CheckoutQuoteCreate(cart_id=cart_id)
    quote = await quote_service.generate_quote(req)

    # Validate totals
    assert quote.subtotal_minor == 300 # 150 * 2
    assert quote.tax_minor == 30
    assert quote.total_minor == 330
    assert quote.lines[0].unit_price_minor == 150

@pytest.mark.asyncio
async def test_quote_expiry_and_stale_detection(quote_service, mock_dependencies):
    quote_id = uuid.uuid4()
    variant_id = uuid.uuid4()

    # Quote generated 10 mins ago, expires in 5 mins
    stored_quote = {
        "id": quote_id,
        "status": "READY",
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5),
        "quote_signature": "valid_signature",
        "subtotal_minor": 300,
        "tax_minor": 30,
        "lines": [{"variant_id": variant_id, "quantity": 2, "unit_price_minor": 150}]
    }

    mock_dependencies["quote_repo"].get_quote.return_value = stored_quote

    # Simulating a price change since quote generation
    mock_dependencies["pricing_svc"].get_active_price.return_value = {"amount": 200, "currency": "USD"} # Price went up!
    
    with pytest.raises(StaleQuoteError, match="Pricing has changed"):
        await quote_service.validate_quote(quote_id)

@pytest.mark.asyncio
async def test_expired_quote_fails_validation(quote_service, mock_dependencies):
    quote_id = uuid.uuid4()

    # Expired quote
    stored_quote = {
        "id": quote_id,
        "status": "EXPIRED",
        "expires_at": datetime.now(timezone.utc) - timedelta(minutes=5),
        "quote_signature": "valid_signature",
        "lines": []
    }

    mock_dependencies["quote_repo"].get_quote.return_value = stored_quote

    with pytest.raises(StaleQuoteError, match="Quote has expired"):
        await quote_service.validate_quote(quote_id)
