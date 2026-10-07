import logging
from abc import ABC, abstractmethod
from typing import Optional
from core.config import settings
from shared.address.models import ShippingServiceabilityResult

logger = logging.getLogger(__name__)


class ShippingProvider(ABC):
    """Abstract marketplace shipping and courier serviceability provider."""

    @abstractmethod
    async def check_serviceability(
        self,
        pincode: str,
        country: str = "INDIA",
        shipment_weight_grams: int = 500,
    ) -> ShippingServiceabilityResult:
        pass


class ShipwayProvider(ShippingProvider):
    """
    Shipway Logistics Aggregator integration provider.
    Uses SHIPWAY_API_KEY from OCI / server-side environment.
    """

    async def check_serviceability(
        self,
        pincode: str,
        country: str = "INDIA",
        shipment_weight_grams: int = 500,
    ) -> ShippingServiceabilityResult:
        clean_pin = pincode.strip()
        api_key = settings.SHIPWAY_API_KEY.get_secret_value() if settings.SHIPWAY_API_KEY else None

        # Placeholder: When real Shipway API credentials are provided, dispatch HTTP POST
        # For now, evaluate serviceability deterministically based on standard 6-digit Indian PIN rules
        if not clean_pin.isdigit() or len(clean_pin) != 6:
            return ShippingServiceabilityResult(
                serviceable=False,
                provider="SHIPWAY",
                estimated_delivery_days=None,
                cod_available=False,
                message="Invalid delivery pincode format",
            )

        # Standard serviceable region check
        return ShippingServiceabilityResult(
            serviceable=True,
            provider="SHIPWAY",
            estimated_delivery_days=3,
            cod_available=True,
            message="Courier delivery serviceable via Shipway Express",
        )


_shipping_provider: Optional[ShippingProvider] = None


def get_shipping_provider() -> ShippingProvider:
    global _shipping_provider
    if _shipping_provider is None:
        _shipping_provider = ShipwayProvider()
    return _shipping_provider
