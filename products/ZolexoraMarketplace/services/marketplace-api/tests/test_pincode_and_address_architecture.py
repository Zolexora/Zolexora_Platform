import pytest
import re
from unittest.mock import AsyncMock, patch
from shared.address.models import PincodeResult, PostOfficeInfo
from shared.address.pincode import FreePincodeProvider
from shared.address.digipin import DIGIPINProvider
from shared.address.validation import GoogleAddressValidationProvider
from shared.address.shipping import ShipwayProvider
from users.router import _normalize_text


@pytest.mark.asyncio
async def test_normalize_text_uppercase_and_spaces():
    """Verify uppercase conversion, space trimming and whitespace normalization."""
    assert _normalize_text("   near   main   market  ") == "NEAR MAIN MARKET"
    assert _normalize_text("123, shiv shakti apartment") == "123, SHIV SHAKTI APARTMENT"
    assert _normalize_text("dadri") == "DADRI"
    assert _normalize_text(None) is None


@pytest.mark.asyncio
async def test_pincode_offline_fallback_and_structure():
    """Verify pincode provider resolves structured geography and post offices."""
    provider = FreePincodeProvider()
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_redis.set.return_value = True

    with patch("shared.address.pincode.get_redis", return_value=mock_redis):
        res = await provider.lookup("203207")
        assert res is not None
        assert res.pincode == "203207"
        assert res.country == "INDIA"
        assert res.state == "UTTAR PRADESH"
        assert res.district in {"GAUTAM BUDDHA NAGAR", "BULANDSHAHR"}
        assert len(res.post_offices) >= 1
        assert res.postal_delivery_status == "DELIVERY AVAILABLE"
        assert any("DADRI" in po.name for po in res.post_offices)


@pytest.mark.asyncio
async def test_pincode_invalid_format_rejected():
    """Verify non-6-digit or non-numeric pincodes are rejected immediately."""
    provider = FreePincodeProvider()
    assert await provider.lookup("12345") is None
    assert await provider.lookup("2032071") is None
    assert await provider.lookup("ABCDEF") is None


@pytest.mark.asyncio
async def test_digipin_accuracy_provider():
    """Verify DIGIPIN format checking and postal grid assessment."""
    provider = DIGIPINProvider()

    # Valid format
    res_valid = await provider.verify_accuracy("203207", "AB-1234-5678")
    assert res_valid.valid is True
    assert res_valid.digipin == "AB-1234-5678"
    assert res_valid.accuracy_score >= 0.9

    # Invalid format
    res_inv = await provider.verify_accuracy("203207", "INVALID-DIGIPIN-TOO-LONG")
    assert res_inv.valid is False
    assert res_inv.accuracy_score == 0.0


@pytest.mark.asyncio
async def test_google_address_validation_placeholder():
    """Verify Google Address Validation structural assessment."""
    provider = GoogleAddressValidationProvider()
    res = await provider.validate_address(
        house_no="123, SHIV SHAKTI",
        village_town="DADRI",
        pincode="203207",
        landmark="NEAR MAIN MARKET",
    )
    assert res.status == "VALID"
    assert res.is_complete is True


@pytest.mark.asyncio
async def test_shipway_serviceability_provider():
    """Verify Shipway courier serviceability check."""
    provider = ShipwayProvider()
    res = await provider.check_serviceability("203207")
    assert res.serviceable is True
    assert res.provider == "SHIPWAY"
    assert res.estimated_delivery_days == 3
    assert res.cod_available is True
