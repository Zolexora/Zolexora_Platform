from abc import ABC, abstractmethod
from typing import List, Optional
import logging

from shipping.schemas import CourierOption, BookingResult, TrackingResult

logger = logging.getLogger("zolexora.shipping")


class ShippingProvider(ABC):
    """
    Abstract base class that every courier provider must implement.
    Keeps all provider-specific logic isolated and testable.
    """

    name: str = "unknown"        # provider slug, e.g. "delhivery"
    display_name: str = "Unknown"  # human-readable name

    # ── Required abstract methods ─────────────────────────────────────────────

    @abstractmethod
    async def check_serviceability(
        self,
        pickup_pincode: str,
        delivery_pincode: str,
        weight_kg: float,
        cod: bool = False,
    ) -> List[CourierOption]:
        """
        Returns a list of available courier options for this provider.
        Each option includes estimated cost, delivery days, and serviceability.
        """
        ...

    @abstractmethod
    async def book_shipment(
        self,
        shipment_id: str,
        order_id: str,
        service_code: str,
        pickup_pincode: str,
        delivery_name: str,
        delivery_phone: str,
        delivery_email: str,
        delivery_address: str,
        delivery_city: str,
        delivery_state: str,
        delivery_pincode: str,
        weight_kg: float,
        length_cm: float,
        breadth_cm: float,
        height_cm: float,
        declared_value: float,
        cod_amount: float = 0.0,
        items: Optional[list] = None,
    ) -> BookingResult:
        """
        Books a shipment and returns AWB + label URL.
        """
        ...

    @abstractmethod
    async def track_shipment(self, awb: str) -> TrackingResult:
        """
        Returns current tracking status and event history.
        """
        ...

    # ── Optional methods (providers override if supported) ────────────────────

    async def request_pickup(self, awb: str, pickup_date: Optional[str] = None) -> dict:
        """Schedule a pickup for the AWB. Override if provider supports it."""
        return {"supported": False, "message": f"{self.display_name} does not support pickup scheduling via API"}

    async def cancel_shipment(self, awb: str) -> dict:
        """Cancel a booked shipment. Override if provider supports it."""
        return {"supported": False, "message": f"{self.display_name} does not support cancellation via API"}

    async def get_label(self, awb: str) -> dict:
        """Re-fetch the shipping label. Override if provider supports it."""
        return {"supported": False, "label_url": None}

    def is_configured(self) -> bool:
        """Returns True if this provider has valid credentials set."""
        return True

    def _log(self, level: str, msg: str, **kwargs):
        fn = getattr(logger, level, logger.info)
        fn(f"[{self.display_name}] {msg}", **kwargs)
