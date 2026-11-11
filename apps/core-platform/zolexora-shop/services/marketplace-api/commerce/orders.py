"""Orders in PostgreSQL: marketplace_order (one per seller organisation and checkout) with an
order_item row per line. Routes work with an order *document* - the shape the API has always
returned - built from those rows: totals, statuses and ownership are columns, each line's
workflow state is its order_item snapshot, and the order's workflow records (cancellations,
returns, shipment events, payment references) live in the details column.
"""

import json
import re
import uuid
from datetime import datetime

from fastapi import HTTPException

# Document keys stored as columns (everything else not derived goes to details).
_DERIVED = {"id", "order_id", "order_number", "storefront_id", "buyer_id", "seller_id", "currency",
            "lines", "shipping_address", "item_subtotal", "shipping_total", "tax_total", "discount_total",
            "grand_total", "status", "payment_status", "fulfillment_status", "checkout_id", "payment_method",
            "payment_method_type", "idempotency_key", "created_at", "updated_at", "_id"}
_COLUMNS = {"status", "payment_status", "fulfillment_status"}

_SELECT = """SELECT o.*, s.storefront_key, org.name AS seller_name FROM marketplace_order o
             JOIN storefront s ON s.id = o.storefront_id JOIN seller_organization org ON org.id = o.organization_id"""


def _uuid(value):
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError):
        return None


def _iso(value) -> str:
    return value.isoformat() if isinstance(value, datetime) else value


def _money(minor: int, currency: str) -> dict:
    return {"amount_minor": minor, "currency": currency}


def _clean(value):
    """JSON-safe copy (enums, datetimes and models become plain values)."""
    return json.loads(json.dumps(value, default=lambda v: getattr(v, "value", None) or str(v)))


async def insert(conn, doc: dict) -> None:
    """Stores an order document and its lines. Run inside the caller's transaction."""
    currency = doc["currency"]
    total = lambda key: int((doc.get(key) or {}).get("amount_minor", 0))  # noqa: E731
    details = _clean({k: v for k, v in doc.items() if k not in _DERIVED})
    await conn.execute(
        """INSERT INTO marketplace_order (id, storefront_id, buyer_id, organization_id, public_order_number, currency,
                                          subtotal_minor, discount_minor, tax_minor, shipping_minor, total_minor,
                                          status, payment_status, fulfillment_status, address_snapshot,
                                          checkout_id, payment_method, idempotency_key, details)
           SELECT $1, s.id, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::json, $16, $17, $18, $19::jsonb
           FROM storefront s WHERE s.storefront_key = $2""",
        uuid.UUID(doc["id"]), str(getattr(doc["storefront_id"], "value", doc["storefront_id"])), uuid.UUID(str(doc["buyer_id"])),
        uuid.UUID(str(doc["seller_id"])), doc["order_number"], currency,
        total("item_subtotal"), total("discount_total"), total("tax_total"), total("shipping_total"), total("grand_total"),
        str(getattr(doc["status"], "value", doc["status"])), doc.get("payment_status", "pending"),
        doc.get("fulfillment_status", "unfulfilled"), json.dumps(_clean(doc.get("shipping_address") or {})),
        _uuid(doc.get("checkout_id")), doc.get("payment_method") or doc.get("payment_method_type"),
        doc.get("idempotency_key"), json.dumps(details),
    )
    for line in doc["lines"]:
        line = _clean(line)
        listing_id = line.get("listing_id") or line.get("product_id")
        line.setdefault("line_id", str(uuid.uuid4()))
        unit = int(line["unit_price"]["amount_minor"])
        row = await conn.fetchrow(
            """INSERT INTO order_item (id, order_id, storefront_id, storefront_listing_id, product_id, variant_id,
                                       organization_id, title, unit_price_minor, quantity, line_total_minor, snapshot)
               SELECT $1, o.id, o.storefront_id, l.id, l.product_id, v.id, l.organization_id, $4, $5, $6, $7, $8::json
               FROM marketplace_order o
               JOIN storefront_listing l ON l.id = $3 AND l.storefront_id = o.storefront_id AND l.organization_id = o.organization_id
               JOIN product_variant v ON v.product_id = l.product_id AND v.is_active
               WHERE o.id = $2
               RETURNING id""",
            uuid.UUID(line["line_id"]), uuid.UUID(doc["id"]), uuid.UUID(str(listing_id)),
            (line.get("title") or line.get("product_title") or "Product")[:300], unit, int(line["quantity"]),
            unit * int(line["quantity"]), json.dumps(line),
        )
        if not row:
            raise HTTPException(409, f"{line.get('title') or line.get('product_title') or 'A product'} is no longer sold by this seller")


def _where(**q) -> tuple[str, list]:
    """Filters: id, ids, storefront (key), buyer_id, seller_id, checkout_id, idempotency_key, status,
    payment_status, payment_method, since (datetime), and details={key: value}."""
    clauses, args = [], []

    def add(sql, value):
        args.append(value)
        clauses.append(sql.replace("?", f"${len(args)}"))

    for key, sql, cast in (
        ("id", "o.id = ?", _uuid), ("buyer_id", "o.buyer_id = ?", _uuid), ("seller_id", "o.organization_id = ?", _uuid),
        ("checkout_id", "o.checkout_id = ?", _uuid), ("storefront", "s.storefront_key = ?", lambda v: str(getattr(v, "value", v))),
        ("idempotency_key", "o.idempotency_key = ?", str), ("status", "o.status = ?", str),
        ("payment_status", "o.payment_status = ?", str), ("payment_method", "o.payment_method = ?", str),
        ("since", "o.created_at >= ?", lambda v: v),
    ):
        if key in q and q[key] is not None:
            value = cast(q[key])
            if value is None:  # not a valid id: matches nothing
                return "WHERE false", []
            add(sql, value)
    if q.get("ids") is not None:
        add("o.id = ANY(?::uuid[])", [i for i in map(_uuid, q["ids"]) if i])
    for key, value in (q.get("details") or {}).items():
        assert re.fullmatch(r"[a-z_]+", key), key  # a field name from code, never from a request
        add(f"o.details ->> '{key}' = ?", str(value))
    return ("WHERE " + " AND ".join(clauses)) if clauses else "", args


async def find(conn, *, limit: int = 200, **q) -> list[dict]:
    where, args = _where(**q)
    rows = await conn.fetch(f"{_SELECT} {where} ORDER BY o.created_at DESC, o.id LIMIT {int(limit)}", *args)
    if not rows:
        return []
    items = await conn.fetch(
        "SELECT order_id, snapshot FROM order_item WHERE order_id = ANY($1::uuid[]) ORDER BY created_at, id",
        [r["id"] for r in rows],
    )
    lines: dict = {}
    for item in items:
        lines.setdefault(item["order_id"], []).append(json.loads(item["snapshot"]))
    return [_doc(r, lines.get(r["id"], [])) for r in rows]


async def get(conn, **q) -> dict | None:
    found = await find(conn, limit=1, **q)
    return found[0] if found else None


async def count(conn, **q) -> int:
    where, args = _where(**q)
    return await conn.fetchval(f"SELECT count(*) FROM marketplace_order o JOIN storefront s ON s.id = o.storefront_id {where}", *args)


async def update(conn, order_id, fields: dict) -> None:
    """Applies a document $set: statuses to columns, lines to their snapshots, the rest to details."""
    oid = _uuid(order_id)
    fields = {k: v for k, v in fields.items() if k != "updated_at"}
    columns = {k: str(getattr(v, "value", v)) for k, v in fields.items() if k in _COLUMNS}
    details = _clean({k: v for k, v in fields.items() if k not in _COLUMNS and k != "lines"})
    sets = [f"{k} = ${i + 2}" for i, k in enumerate(columns)]
    await conn.execute(
        f"""UPDATE marketplace_order SET {''.join(s + ', ' for s in sets)}details = details || ${len(columns) + 2}::jsonb,
                   version = version + 1, updated_at = now() WHERE id = $1""",
        oid, *columns.values(), json.dumps(details),
    )
    for line in fields.get("lines") or []:
        line = _clean(line)
        await conn.execute("UPDATE order_item SET snapshot = $3::json WHERE order_id = $1 AND id = $2",
                           oid, _uuid(line.get("line_id")), json.dumps(line))


async def update_many(conn, fields: dict, **q) -> list[str]:
    """Applies fields to every order matching q; returns their ids."""
    where, args = _where(**q)
    ids = [str(r["id"]) for r in await conn.fetch(
        f"SELECT o.id FROM marketplace_order o JOIN storefront s ON s.id = o.storefront_id {where} FOR UPDATE OF o", *args)]
    for order_id in ids:
        await update(conn, order_id, fields)
    return ids


def _doc(r, lines: list) -> dict:
    currency = r["currency"]
    details = json.loads(r["details"]) if isinstance(r["details"], str) else dict(r["details"] or {})
    address = r["address_snapshot"]
    return {
        **details,
        "id": str(r["id"]),
        "order_id": str(r["id"]),
        "order_number": r["public_order_number"],
        "checkout_id": str(r["checkout_id"]) if r["checkout_id"] else None,
        "storefront_id": r["storefront_key"],
        "buyer_id": str(r["buyer_id"]),
        "seller_id": str(r["organization_id"]),
        "seller_name": details.get("seller_name") or r["seller_name"],
        "status": r["status"],
        "payment_status": r["payment_status"],
        "fulfillment_status": r["fulfillment_status"],
        "currency": currency,
        "lines": lines,
        "shipping_address": json.loads(address) if isinstance(address, str) else address,
        "payment_method": r["payment_method"],
        "payment_method_type": r["payment_method"],
        "idempotency_key": r["idempotency_key"],
        "item_subtotal": _money(r["subtotal_minor"], currency),
        "shipping_total": _money(r["shipping_minor"], currency),
        "tax_total": _money(r["tax_minor"], currency),
        "discount_total": _money(r["discount_minor"], currency),
        "grand_total": _money(r["total_minor"], currency),
        "created_at": _iso(r["created_at"]),
        "updated_at": _iso(r["updated_at"]),
    }
