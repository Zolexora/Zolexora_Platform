import uuid
import json
import asyncpg

class PaymentOrchestrationRepository:
    def __init__(self, connection: asyncpg.Connection):
        self.connection = connection

    async def get_webhook_receipt(self, provider: str, external_event_id: str):
        row = await self.connection.fetchrow(
            """
            SELECT id, status FROM payment_webhook_receipt
            WHERE provider = $1 AND external_event_id = $2
            """,
            provider, external_event_id
        )
        return dict(row) if row else None

    async def create_webhook_receipt(self, storefront_id: uuid.UUID, provider: str, external_event_id: str, status: str, payload: dict, signature: str):
        row = await self.connection.fetchrow(
            """
            INSERT INTO payment_webhook_receipt (id, storefront_id, provider, external_event_id, status, payload, signature)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (provider, external_event_id) DO NOTHING
            RETURNING id, status
            """,
            uuid.uuid4(), storefront_id, provider, external_event_id, status, json.dumps(payload), signature
        )
        return dict(row) if row else None

    async def update_webhook_receipt_status(self, receipt_id: uuid.UUID, status: str):
        await self.connection.execute(
            """
            UPDATE payment_webhook_receipt SET status = $1 WHERE id = $2
            """,
            status, receipt_id
        )

    async def get_payment_record(self, external_reference: str):
        row = await self.connection.fetchrow(
            """
            SELECT id, order_id, amount_minor, currency FROM payment_record
            WHERE external_reference = $1
            """,
            external_reference
        )
        return dict(row) if row else None

    async def update_payment_record_status(self, record_id: uuid.UUID, status: str):
        await self.connection.execute(
            """
            UPDATE payment_record SET status = $1 WHERE id = $2
            """,
            status, record_id
        )

    async def update_order_payment_status(self, order_id: uuid.UUID, payment_status: str):
        await self.connection.execute(
            """
            UPDATE marketplace_order SET payment_status = $1 WHERE id = $2
            """,
            payment_status, order_id
        )

    async def create_transaction_ledger(self, payment_record_id: uuid.UUID, type: str, amount_minor: int, currency: str):
        await self.connection.execute(
            """
            INSERT INTO payment_transaction_ledger (id, payment_record_id, type, amount_minor, currency)
            VALUES ($1, $2, $3, $4, $5)
            """,
            uuid.uuid4(), payment_record_id, type, amount_minor, currency
        )
