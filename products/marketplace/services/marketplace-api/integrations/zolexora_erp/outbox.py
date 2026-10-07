import json
import hashlib
from datetime import datetime, timezone
from uuid import uuid4
import asyncpg

async def sync_to_erp_outbox(
    conn: asyncpg.Connection,
    event_type: str,
    aggregate_type: str,
    aggregate_id: str,
    payload: dict,
    storefront_id: str = None,
    tenant_id: str = None,
):
    """
    Synchronizes an event to the ERP outbox using raw asyncpg.
    This ensures that the event is reliably captured without blocking the checkout flow.
    """
    payload_json = json.dumps(payload)
    payload_hash = hashlib.sha256(payload_json.encode('utf-8')).hexdigest()
    
    idempotency_key = f"{event_type}_{aggregate_id}_{uuid4()}"
    
    query = """
    INSERT INTO erp_outbox (
        id, event_type, schema_version, aggregate_type, aggregate_id,
        storefront_id, idempotency_key, payload_json,
        payload_hash, status, attempt_count, available_at,
        created_at, updated_at
    ) VALUES (
        $1, $2, '1.0', $3, $4, $5, $6, $7, $8, 'pending', 0, $9, $10, $11
    )
    """
    
    now = datetime.now(timezone.utc)
    
    await conn.execute(
        query,
        str(uuid4()),
        event_type,
        aggregate_type,
        aggregate_id,
        storefront_id,
        idempotency_key,
        payload_json,
        payload_hash,
        now,
        now,
        now
    )
