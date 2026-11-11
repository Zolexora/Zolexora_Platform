import logging
from abc import ABC, abstractmethod
from typing import Optional
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
        # Only the pincode format is checked here; couriers confirm serviceability when the seller books.
        if not clean_pin.isdigit() or len(clean_pin) != 6:
            return ShippingServiceabilityResult(
                serviceable=False,
                provider="SHIPWAY",
                estimated_delivery_days=None,
                cod_available=False,
                message="Invalid delivery pincode format",
            )

        return ShippingServiceabilityResult(
            serviceable=True,
            provider="NONE",
            estimated_delivery_days=None,
            cod_available=False,
            message="Pincode accepted; the courier confirms delivery when the order ships",
        )


_shipping_provider: Optional[ShippingProvider] = None


def get_shipping_provider() -> ShippingProvider:
    global _shipping_provider
    if _shipping_provider is None:
        _shipping_provider = ShipwayProvider()
    return _shipping_provider
