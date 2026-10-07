import pytest
from httpx import AsyncClient
from datetime import datetime, timezone
import json
import hashlib
import uuid

from integrations.zolexora_erp.outbox import sync_to_erp_outbox
from integrations.zolexora_erp.adapter import SignedWebhookReceiver

@pytest.mark.asyncio
async def test_sync_to_erp_outbox_atomicity(postgres_database, db_connection):
    """Test outbox insertion is atomic and commits properly."""
    order_id = str(uuid.uuid4())
    payload = {"order_id": order_id, "total": 100}
    
    await sync_to_erp_outbox(
        conn=db_connection,
        event_type="order.created",
        aggregate_type="order",
        aggregate_id=order_id,
        payload=payload,
        storefront_id=None
    )
    
    # Verify insertion
    row = await db_connection.fetchrow(
        "SELECT * FROM erp_outbox WHERE aggregate_id = $1", order_id
    )
    assert row is not None
    assert row["event_type"] == "order.created"
    assert row["status"] == "pending"

@pytest.mark.asyncio
async def test_webhook_validation():
    """Test webhook receiver validation."""
    from main import app
    from httpx import ASGITransport
    import hmac
    payload = json.dumps({
        "schema_version": "1.0",
        "event_id": str(uuid.uuid4()),
        "event_type": "sales_order.created",
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "source_system": "erp",
        "source_tenant_id": "tenant-1",
        "organization_external_id": "org-1",
        "correlation_id": "cor-1",
        "idempotency_key": "idemp-1",
        "payload": {}
    })
    
    signature = hmac.new(b"erp_secret_key", payload.encode(), hashlib.sha256).hexdigest()
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(
            "/api/erp/webhooks",
            content=payload,
            headers={"x-erp-signature": signature}
        )
    assert response.status_code == 200

@pytest.mark.asyncio
async def test_webhook_invalid_signature():
    """Test webhook rejects invalid signatures."""
    from main import app
    from httpx import ASGITransport
    payload = '{"test": "data"}'
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(
            "/api/erp/webhooks",
            content=payload,
            headers={"x-erp-signature": "invalid"}
        )
    assert response.status_code == 401
    
@pytest.mark.asyncio
async def test_duplicate_inbox_events_idempotency():
    """Test webhook receiver is idempotent."""
    receiver = SignedWebhookReceiver(secret="erp_secret_key")
    
    event_data = {
        "schema_version": "1.0",
        "event_id": str(uuid.uuid4()),
        "event_type": "sales_order.created",
        "occurred_at": datetime.now(timezone.utc),
        "source_system": "erp",
        "source_tenant_id": "tenant-1",
        "organization_external_id": "org-1",
        "correlation_id": "cor-1",
        "idempotency_key": "idemp-dup",
        "payload": {}
    }
    from integrations.zolexora_erp.contracts import EventEnvelope
    event = EventEnvelope(**event_data)
    
    # Process first time
    await receiver.process(event)
    assert "idemp-dup" in receiver.processed_events
    
    # Process second time (should be no-op)
    await receiver.process(event)
    assert len(receiver.processed_events) == 1
