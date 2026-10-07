from abc import ABC, abstractmethod
from typing import Any, Dict, List
import uuid

class ShippingProviderAdapter(ABC):
    @abstractmethod
    def get_rates(self, origin: Dict[str, Any], destination: Dict[str, Any], items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def create_shipment(self, order_id: uuid.UUID, items: List[Dict[str, Any]], destination: Dict[str, Any]) -> Dict[str, Any]:
        pass

class FakeShippingProvider(ShippingProviderAdapter):
    def get_rates(self, origin: Dict[str, Any], destination: Dict[str, Any], items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return [
            {
                "service_code": "fake_standard",
                "service_name": "Fake Standard Shipping",
                "amount_minor": 500,
                "currency": "USD",
                "estimated_days": 3
            }
        ]

    def create_shipment(self, order_id: uuid.UUID, items: List[Dict[str, Any]], destination: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "tracking_number": f"FAKE-{order_id}",
            "status": "shipped",
            "label_url": "https://fake-shipping-provider.test/label.pdf"
        }
