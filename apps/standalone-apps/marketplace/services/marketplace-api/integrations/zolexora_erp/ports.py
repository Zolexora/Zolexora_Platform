from typing import Protocol

from .contracts import EventEnvelope, ReconciliationResult, SalesOrderRequest


class ERPCommandPort(Protocol):
    async def create_sales_order(self, request: SalesOrderRequest) -> str: ...


class ERPQueryPort(Protocol):
    async def get_inventory(self, item_external_id: str, warehouse_external_id: str): ...


class ERPEventPublisherPort(Protocol):
    async def publish(self, event: EventEnvelope) -> None: ...


class ERPWebhookProcessorPort(Protocol):
    async def process(self, event: EventEnvelope) -> None: ...


class ERPReconciliationPort(Protocol):
    async def reconcile(self, entity_type: str) -> tuple[ReconciliationResult, ...]: ...
