import uuid
import asyncpg
from typing import Any, Dict
from .ports import PaymentProviderAdapter
from .repository import PaymentOrchestrationRepository

class PaymentOrchestrationService:
    def __init__(self, connection: asyncpg.Connection, provider_adapter: PaymentProviderAdapter):
        self.connection = connection
        self.repository = PaymentOrchestrationRepository(connection)
        self.provider_adapter = provider_adapter

    async def process_webhook(self, storefront_id: uuid.UUID, provider: str, payload: bytes, signature: str, secret: str, json_payload: Dict[str, Any]):
        if not self.provider_adapter.verify_webhook_signature(payload, signature, secret):
            raise ValueError("Invalid webhook signature")

        event_details = self.provider_adapter.extract_event_details(json_payload)
        external_event_id = event_details["event_id"]
        event_type = event_details["type"]
        payment_ref = event_details["payment_reference"]

        existing_receipt = await self.repository.get_webhook_receipt(provider, external_event_id)
        if existing_receipt:
            return {"status": existing_receipt["status"], "message": "Already processed"}

        receipt = await self.repository.create_webhook_receipt(
            storefront_id=storefront_id,
            provider=provider,
            external_event_id=external_event_id,
            status="unprocessed",
            payload=json_payload,
            signature=signature
        )

        record = await self.repository.get_payment_record(payment_ref)
        if not record:
            await self.repository.update_webhook_receipt_status(receipt["id"], "failed")
            raise ValueError("Payment record not found")

        try:
            if event_type == "CAPTURE":
                await self.repository.create_transaction_ledger(record["id"], "CAPTURE", record["amount_minor"], record["currency"])
                await self.repository.update_payment_record_status(record["id"], "captured")
                await self.repository.update_order_payment_status(record["order_id"], "paid")
            elif event_type == "FAILURE":
                await self.repository.create_transaction_ledger(record["id"], "FAILURE", record["amount_minor"], record["currency"])
                await self.repository.update_payment_record_status(record["id"], "failed")
                await self.repository.update_order_payment_status(record["order_id"], "failed")

            await self.repository.update_webhook_receipt_status(receipt["id"], "processed")
        except Exception as e:
            await self.repository.update_webhook_receipt_status(receipt["id"], "failed")
            raise e

        return {"status": "processed", "message": "Successfully processed webhook"}
