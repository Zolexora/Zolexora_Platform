"""Shipping in PostgreSQL: one shipment row per order and the seller organisation's pickup
locations. Routes work with a shipment *document* (the shape the API has always returned): the
carrier's progress, AWB, service code and attention flag are columns; addresses, package, the
chosen courier, options, booking attempts and tracking events live in the details column.
"""

import json
import uuid
from datetime import datetime

# Courier progress -> the order-wide fulfilment vocabulary of shipment.status.
_FULFILMENT = {"booked": "allocated", "pickup_requested": "processing", "in_transit": "shipped",
               "out_for_delivery": "out_for_delivery", "delivered": "delivered", "cancelled": "cancelled"}
# Document key -> shipment column.
_COLUMNS = {"current_status": "courier_status", "awb": "external_reference",
            "selected_service_code": "service_code", "shipping_attention_required": "attention_required"}
_DERIVED = {"id", "order_id", "seller_id", "buyer_id", "storefront_id", "created_at", "updated_at", "_id", *_COLUMNS}

_SELECT = """SELECT sh.*, o.buyer_id, s.storefront_key FROM shipment sh
             JOIN marketplace_order o ON o.id = sh.order_id JOIN storefront s ON s.id = sh.storefront_id"""


def _uuid(value):
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError):
        return None


def _iso(value):
    return value.isoformat() if isinstance(value, datetime) else value


def _json(value) -> str:
    return json.dumps(value, default=lambda v: getattr(v, "value", None) or str(v))


def _doc(row) -> dict:
    details = json.loads(row["details"]) if isinstance(row["details"], str) else dict(row["details"] or {})
    return {**details,
            "id": str(row["id"]), "order_id": str(row["order_id"]), "seller_id": str(row["organization_id"]),
            "buyer_id": str(row["buyer_id"]), "storefront_id": row["storefront_key"],
            "current_status": row["courier_status"], "fulfillment_status": row["status"], "awb": row["external_reference"],
            "selected_service_code": row["service_code"], "shipping_attention_required": row["attention_required"],
            "created_at": _iso(row["created_at"]), "updated_at": _iso(row["updated_at"])}


def _where(q: dict) -> tuple[str, list]:
    """Filters: id, order_id, seller_id (organisation), awb, current_status, attention and
    party=(user id, organisation id or None) - the buyer or the seller of the shipment."""
    sql, args = [], []

    def arg(value):
        args.append(value)
        return f"${len(args)}"

    for key, column in (("id", "sh.id"), ("order_id", "sh.order_id"), ("seller_id", "sh.organization_id")):
        if key in q and q[key] is not None:
            value = _uuid(q[key])
            sql.append(f"{column} = {arg(value)}" if value else "FALSE")
    if q.get("awb") is not None:
        sql.append(f"sh.external_reference = {arg(q['awb'])}")
    if q.get("current_status") is not None:
        sql.append(f"sh.courier_status = {arg(q['current_status'])}")
    if q.get("attention") is not None:
        sql.append(f"sh.attention_required = {arg(q['attention'])}")
    if q.get("party"):
        buyer, org = (_uuid(v) for v in q["party"])
        sql.append(f"(o.buyer_id = {arg(buyer)} OR sh.organization_id = {arg(org)})")
    return (" WHERE " + " AND ".join(sql)) if sql else "", args


async def get(conn, **q) -> dict | None:
    where, args = _where(q)
    row = await conn.fetchrow(f"{_SELECT}{where} LIMIT 1", *args)
    return _doc(row) if row else None


async def find(conn, *, limit: int = 500, **q) -> list[dict]:
    where, args = _where(q)
    rows = await conn.fetch(f"{_SELECT}{where} ORDER BY sh.created_at DESC LIMIT {int(limit)}", *args)
    return [_doc(r) for r in rows]


async def count(conn, **q) -> int:
    where, args = _where(q)
    return await conn.fetchval(f"SELECT count(*) FROM shipment sh JOIN marketplace_order o ON o.id = sh.order_id{where}", *args)


async def get_or_create(conn, order: dict) -> dict:
    """The order's shipment, created on first use (one per order, safe against a double click)."""
    details = {"declared_value": order["grand_total"]["amount_minor"] / 100, "cod_amount": 0.0}
    await conn.execute(
        """INSERT INTO shipment (id, order_id, storefront_id, organization_id, details)
           SELECT $1, o.id, o.storefront_id, o.organization_id, $3::jsonb FROM marketplace_order o WHERE o.id = $2
           ON CONFLICT (order_id) DO NOTHING""",
        uuid.uuid4(), uuid.UUID(order["id"]), _json(details))
    return await get(conn, order_id=order["id"])


async def update(conn, shipment_id: str, fields: dict) -> None:
    sets, args = ["updated_at = now()"], [uuid.UUID(shipment_id)]
    for key, column in _COLUMNS.items():
        if key in fields:
            args.append(fields[key])
            sets.append(f"{column} = ${len(args)}")
    if "current_status" in fields:
        args.append(_FULFILMENT.get(fields["current_status"], "unfulfilled"))
        sets.append(f"status = ${len(args)}")
    details = {k: v for k, v in fields.items() if k not in _DERIVED}
    if details:
        args.append(_json(details))
        sets.append(f"details = details || ${len(args)}::jsonb")
    await conn.execute(f"UPDATE shipment SET {', '.join(sets)} WHERE id = $1", *args)


async def append(conn, shipment_id: str, key: str, items: list) -> None:
    """Adds records (booking attempts, tracking events) to a details list in one statement."""
    await conn.execute(
        """UPDATE shipment SET details = jsonb_set(details, ARRAY[$2], COALESCE(details -> $2, '[]'::jsonb) || $3::jsonb),
                  updated_at = now() WHERE id = $1""",
        uuid.UUID(shipment_id), key, _json(items))


async def claim_booking(conn, shipment_id: str, now: str, stale: str) -> bool:
    """Marks an unbooked shipment as being booked, unless another booking (newer than `stale`) runs."""
    return await conn.fetchval(
        """UPDATE shipment SET courier_status = 'booking', status = 'unfulfilled', updated_at = now(),
                  details = details || jsonb_build_object('auto_booking_attempted_at', $2::text)
           WHERE id = $1 AND external_reference IS NULL
             AND (courier_status <> 'booking' OR COALESCE(details ->> 'auto_booking_attempted_at', '') < $3)
           RETURNING true""",
        uuid.UUID(shipment_id), now, stale) or False


# ── Pickup locations ──────────────────────────────────────────────────────────

_PICKUP_FIELDS = ("label", "contact_name", "phone", "email", "address_line_1", "address_line_2",
                  "city", "state", "pincode", "country", "gst_number", "is_default")


def _pickup(row) -> dict:
    return {**{k: row[k] for k in _PICKUP_FIELDS}, "id": str(row["id"]), "seller_id": str(row["organization_id"]),
            "created_at": _iso(row["created_at"]), "updated_at": _iso(row["updated_at"])}


async def pickups(conn, org: str | None) -> list[dict]:
    """The organisation's pickup locations (all of them for org=None)."""
    if org is None:
        rows = await conn.fetch("SELECT * FROM pickup_location ORDER BY created_at LIMIT 500")
    else:
        rows = await conn.fetch("SELECT * FROM pickup_location WHERE organization_id = $1 ORDER BY created_at LIMIT 50", _uuid(org))
    return [_pickup(r) for r in rows]


async def pickup(conn, org: str | None, location_id: str | None = None) -> dict | None:
    """One location of the organisation (any organisation's for org=None); without an id, the
    default one, else the oldest."""
    if location_id is not None:
        row = await conn.fetchrow("SELECT * FROM pickup_location WHERE id = $1 AND ($2::uuid IS NULL OR organization_id = $2)",
                                  _uuid(location_id), _uuid(org))
    else:
        row = await conn.fetchrow("SELECT * FROM pickup_location WHERE organization_id = $1 ORDER BY is_default DESC, created_at LIMIT 1",
                                  _uuid(org))
    return _pickup(row) if row else None


async def add_pickup(conn, org: str, data: dict) -> dict:
    async with conn.transaction():
        if data.get("is_default"):
            await conn.execute("UPDATE pickup_location SET is_default = false WHERE organization_id = $1", uuid.UUID(org))
        row = await conn.fetchrow(
            f"""INSERT INTO pickup_location (id, organization_id, {", ".join(_PICKUP_FIELDS)})
                VALUES ($1, $2, {", ".join(f"${i + 3}" for i in range(len(_PICKUP_FIELDS)))}) RETURNING *""",
            uuid.uuid4(), uuid.UUID(org), *(data[k] for k in _PICKUP_FIELDS))
    return _pickup(row)


async def update_pickup(conn, location: dict, changes: dict) -> None:
    changes = {k: v for k, v in changes.items() if k in _PICKUP_FIELDS}
    if not changes:
        return
    async with conn.transaction():
        if changes.get("is_default"):
            await conn.execute("UPDATE pickup_location SET is_default = false WHERE organization_id = $1", uuid.UUID(location["seller_id"]))
        sets = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(changes))
        await conn.execute(f"UPDATE pickup_location SET {sets}, updated_at = now() WHERE id = $1",
                           uuid.UUID(location["id"]), *changes.values())


async def delete_pickup(conn, org: str | None, location_id: str) -> None:
    await conn.execute("DELETE FROM pickup_location WHERE id = $1 AND ($2::uuid IS NULL OR organization_id = $2)",
                       _uuid(location_id), _uuid(org))
