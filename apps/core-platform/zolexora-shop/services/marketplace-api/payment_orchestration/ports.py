import abc
from typing import Any, Dict

class PaymentProviderAdapter(abc.ABC):
    @abc.abstractmethod
    def verify_webhook_signature(self, payload: bytes, signature: str, secret: str) -> bool:
        """Verify the webhook signature."""
        pass

    @abc.abstractmethod
    def extract_event_details(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Extract event id, type, and associated payment reference."""
        pass
