"""ERP outbox: events written in the same transaction as the change they describe, for the
ERP publisher to deliver. One row per event (the idempotency key is the event and aggregate)."""

import hashlib
import json
import uuid


async def sync_to_erp_outbox(conn, event_type: str, aggregate_type: str, aggregate_id: str, payload: dict,
                             storefront_key: str | None = None) -> None:
    payload_json = json.dumps(payload, default=str, sort_keys=True)
    await conn.execute(
        """INSERT INTO erp_outbox (id, event_type, schema_version, aggregate_type, aggregate_id, storefront_id,
                                   idempotency_key, payload_json, payload_hash, status, attempt_count, available_at)
           VALUES ($1, $2, '1.0', $3, $4, (SELECT id FROM storefront WHERE storefront_key = $5),
                   $6, $7::json, $8, 'pending', 0, now())
           ON CONFLICT (idempotency_key) DO NOTHING""",
        uuid.uuid4(), event_type, aggregate_type, str(aggregate_id), storefront_key,
        f"{event_type}:{aggregate_id}", payload_json, hashlib.sha256(payload_json.encode()).hexdigest(),
    )
