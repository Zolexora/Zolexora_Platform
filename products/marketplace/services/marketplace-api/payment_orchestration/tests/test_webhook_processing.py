import pytest
import uuid
import asyncpg
import asyncio
from payment_orchestration.service import PaymentOrchestrationService
from payment_orchestration.ports import PaymentProviderAdapter

import os

TEST_URL = os.environ.get("DATABASE_URL", "postgresql://marketplace_local:marketplace-local-only@postgres:5432/marketplace_local")

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
async def db_connection():
    connection = await asyncpg.connect(TEST_URL)
    transaction = connection.transaction()
    await transaction.start()
    try:
        yield connection
    finally:
        await transaction.rollback()
        await connection.close()

class MockProviderAdapter(PaymentProviderAdapter):
    def verify_webhook_signature(self, payload: bytes, signature: str, secret: str) -> bool:
        return signature == "valid_signature"

    def extract_event_details(self, payload: dict) -> dict:
        return {
            "event_id": payload.get("id"),
            "type": payload.get("type"),
            "payment_reference": payload.get("payment_ref")
        }

@pytest.mark.asyncio
async def test_process_webhook_signature_failure(db_connection: asyncpg.Connection):
    adapter = MockProviderAdapter()
    service = PaymentOrchestrationService(db_connection, adapter)
    
    with pytest.raises(ValueError, match="Invalid webhook signature"):
        await service.process_webhook(
            storefront_id=uuid.uuid4(),
            provider="test_provider",
            payload=b"{}",
            signature="invalid_signature",
            secret="secret",
            json_payload={"id": "evt_1", "type": "CAPTURE", "payment_ref": "pay_1"}
        )

@pytest.mark.asyncio
async def test_process_webhook_capture_lifecycle(db_connection: asyncpg.Connection):
    adapter = MockProviderAdapter()
    service = PaymentOrchestrationService(db_connection, adapter)
    
    # Needs valid records in db to not fail foreign key constraints
    # I'll create dummy user and storefront
    buyer_id = uuid.uuid4()
    seller_id = uuid.uuid4()
    storefront_id = uuid.uuid4()
    
    await db_connection.execute("INSERT INTO users (id, email) VALUES ($1, $2)", buyer_id, "buyer@t.com")
    await db_connection.execute("INSERT INTO users (id, email) VALUES ($1, $2)", seller_id, "seller@t.com")
    await db_connection.execute("INSERT INTO storefront (id, storefront_key, display_name, currency, locale) VALUES ($1, $2, $3, $4, $5)", storefront_id, "s1", "s1", "USD", "en-US")
    
    order_id = uuid.uuid4()
    await db_connection.execute("""
        INSERT INTO marketplace_order (id, storefront_id, buyer_id, seller_id, public_order_number, currency, subtotal_minor, total_minor, status, payment_status, fulfillment_status, address_snapshot)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    """, order_id, storefront_id, buyer_id, seller_id, "O1", "USD", 1000, 1000, "placed", "pending", "unfulfilled", "{}")
    
    pay_id = uuid.uuid4()
    await db_connection.execute("""
        INSERT INTO payment_record (id, order_id, storefront_id, amount_minor, currency, status, idempotency_key, external_reference)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    """, pay_id, order_id, storefront_id, 1000, "USD", "authorized", "idk1", "pay_1")
    
    res = await service.process_webhook(
        storefront_id=storefront_id,
        provider="test_provider",
        payload=b'{"id": "evt_1", "type": "CAPTURE", "payment_ref": "pay_1"}',
        signature="valid_signature",
        secret="secret",
        json_payload={"id": "evt_1", "type": "CAPTURE", "payment_ref": "pay_1"}
    )
    assert res["status"] == "processed"
    
    res2 = await service.process_webhook(
        storefront_id=storefront_id,
        provider="test_provider",
        payload=b'{"id": "evt_1", "type": "CAPTURE", "payment_ref": "pay_1"}',
        signature="valid_signature",
        secret="secret",
        json_payload={"id": "evt_1", "type": "CAPTURE", "payment_ref": "pay_1"}
    )
    assert res2["message"] == "Already processed"

    record = await db_connection.fetchrow("SELECT status FROM payment_record WHERE id = $1", pay_id)
    assert record["status"] == "captured"
    
    order = await db_connection.fetchrow("SELECT payment_status FROM marketplace_order WHERE id = $1", order_id)
    assert order["payment_status"] == "paid"
    
    ledger = await db_connection.fetch("SELECT type FROM payment_transaction_ledger WHERE payment_record_id = $1", pay_id)
    assert len(ledger) == 1
    assert ledger[0]["type"] == "CAPTURE"
