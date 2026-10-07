import hashlib
import hmac

from .contracts import EventEnvelope, SalesOrderRequest
from .ports import ERPCommandPort, ERPQueryPort, ERPEventPublisherPort, ERPWebhookProcessorPort

class FakeERPAdapter(ERPCommandPort, ERPQueryPort, ERPEventPublisherPort):
    """
    Idempotent ERP client that routes through a Fake ERP adapter.
    """
    def __init__(self):
        self.published_events = []
        self.orders_created = []

    async def create_sales_order(self, request: SalesOrderRequest) -> str:
        self.orders_created.append(request)
        return request.order_external_id

    async def get_inventory(self, item_external_id: str, warehouse_external_id: str):
        pass

    async def publish(self, event: EventEnvelope) -> None:
        self.published_events.append(event)


class SignedWebhookReceiver(ERPWebhookProcessorPort):
    """
    Signed webhook receiver.
    """
    def __init__(self, secret: str):
        self.secret = secret
        self.processed_events = set()

    def verify_signature(self, payload: bytes, signature: str) -> bool:
        expected = hmac.new(self.secret.encode(), payload, hashlib.sha256).hexdigest()
        return expected == signature

    async def process(self, event: EventEnvelope) -> None:
        if event.idempotency_key in self.processed_events:
            return # Idempotent
        self.processed_events.add(event.idempotency_key)
