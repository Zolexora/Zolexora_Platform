"""Stock held for orders (inventory_reservation over inventory_ledger).

Placing an order reserves stock until it is paid (reserved_quantity grows, so nobody else can
buy it); payment consumes the reservation (on hand goes down); cancellation or a rejected
payment releases it, and returns consumed stock to the shelf. A reservation that runs out
before payment is released the next time anyone reserves that product. Every call runs on
the caller's connection, inside its transaction. The reference is the order id.
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

# How long an unpaid order holds stock: gateways settle in minutes, UPI waits for an admin.
HOLD = {"upi": timedelta(hours=48)}
DEFAULT_HOLD = timedelta(minutes=30)


async def _expire_lapsed(conn, variant_ids) -> None:
    lapsed = await conn.fetch(
        """UPDATE inventory_reservation SET status = 'EXPIRED', updated_at = now()
           WHERE status = 'ACTIVE' AND expires_at < now() AND variant_id = ANY($1::uuid[])
           RETURNING variant_id, organization_id, quantity""",
        list(variant_ids),
    )
    for r in lapsed:
        await conn.execute(
            """UPDATE inventory_ledger SET reserved_quantity = reserved_quantity - $3, updated_at = now()
               WHERE variant_id = $1 AND organization_id = $2""",
            r["variant_id"], r["organization_id"], r["quantity"],
        )


async def reserve(conn, reference: str, lines, payment_method: str = "") -> None:
    """Holds stock for an order's lines [(listing_id, quantity, title)]; 409 if any is short."""
    rows = await conn.fetch(
        """SELECT l.id::text AS listing_id, v.id AS variant_id, l.organization_id
           FROM storefront_listing l JOIN product_variant v ON v.product_id = l.product_id AND v.is_active
           WHERE l.id = ANY($1::uuid[])""",
        [uuid.UUID(str(lid)) for lid, _, _ in lines],
    )
    variant = {r["listing_id"]: r for r in rows}
    wanted: dict[tuple, list] = {}
    for listing_id, quantity, title in lines:
        r = variant.get(str(listing_id))
        if not r:
            raise HTTPException(409, f"{title} is no longer available")
        entry = wanted.setdefault((r["variant_id"], r["organization_id"]), [0, title])
        entry[0] += quantity
    await _expire_lapsed(conn, {v for v, _ in wanted})
    expires_at = datetime.now(timezone.utc) + HOLD.get(payment_method, DEFAULT_HOLD)
    for (variant_id, org_id), (quantity, title) in sorted(wanted.items()):  # one lock order: no deadlocks
        held = await conn.fetchval(
            """UPDATE inventory_ledger SET reserved_quantity = reserved_quantity + $3, updated_at = now()
               WHERE variant_id = $1 AND organization_id = $2 AND status = 'ACTIVE'
                 AND on_hand_quantity - reserved_quantity >= $3
               RETURNING id""",
            variant_id, org_id, quantity,
        )
        if not held:
            raise HTTPException(409, f"Not enough stock for {title}; review your cart")
        await conn.execute(
            """INSERT INTO inventory_reservation (id, variant_id, organization_id, quantity, status, expires_at, reference_id)
               VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $6)""",
            uuid.uuid4(), variant_id, org_id, quantity, expires_at, reference,
        )


async def consume(conn, reference: str) -> None:
    """The order was paid: its stock leaves the shelf. A hold that lapsed before payment takes
    whatever is still free (the buyer has paid)."""
    rows = await conn.fetch(
        """WITH old AS (SELECT id, status FROM inventory_reservation
                        WHERE reference_id = $1 AND status IN ('ACTIVE', 'EXPIRED') FOR UPDATE)
           UPDATE inventory_reservation r SET status = 'CONSUMED', updated_at = now()
           FROM old WHERE r.id = old.id
           RETURNING r.variant_id, r.organization_id, r.quantity, old.status AS was""",
        reference,
    )
    for r in rows:
        if r["was"] == "ACTIVE":
            taken = await conn.fetchval(
                """UPDATE inventory_ledger
                   SET on_hand_quantity = on_hand_quantity - $3, reserved_quantity = reserved_quantity - $3, updated_at = now()
                   WHERE variant_id = $1 AND organization_id = $2 RETURNING $3::bigint""",
                r["variant_id"], r["organization_id"], r["quantity"],
            )
        else:
            taken = await conn.fetchval(
                """UPDATE inventory_ledger l
                   SET on_hand_quantity = on_hand_quantity - LEAST($3, on_hand_quantity - reserved_quantity), updated_at = now()
                   FROM (SELECT LEAST($3, on_hand_quantity - reserved_quantity) AS n FROM inventory_ledger
                         WHERE variant_id = $1 AND organization_id = $2) x
                   WHERE l.variant_id = $1 AND l.organization_id = $2 RETURNING x.n""",
                r["variant_id"], r["organization_id"], r["quantity"],
            )
        await _audit(conn, r, -(taken or 0), "order_paid", reference)


async def release(conn, reference: str) -> None:
    """The order was cancelled or its payment rejected: held stock is freed and sold stock
    goes back on the shelf."""
    rows = await conn.fetch(
        """WITH old AS (SELECT id, status FROM inventory_reservation
                        WHERE reference_id = $1 AND status IN ('ACTIVE', 'CONSUMED') FOR UPDATE)
           UPDATE inventory_reservation r SET status = 'RELEASED', updated_at = now()
           FROM old WHERE r.id = old.id
           RETURNING r.variant_id, r.organization_id, r.quantity, old.status AS was""",
        reference,
    )
    for r in rows:
        column = "reserved_quantity" if r["was"] == "ACTIVE" else "on_hand_quantity"
        sign = "-" if r["was"] == "ACTIVE" else "+"
        await conn.execute(
            f"""UPDATE inventory_ledger SET {column} = {column} {sign} $3, updated_at = now()
                WHERE variant_id = $1 AND organization_id = $2""",
            r["variant_id"], r["organization_id"], r["quantity"],
        )
        if r["was"] == "CONSUMED":
            await _audit(conn, r, r["quantity"], "order_cancelled", reference)


async def _audit(conn, r, change: int, reason: str, reference: str) -> None:
    await conn.execute(
        """INSERT INTO inventory_audit_log (id, variant_id, organization_id, change_quantity, reason, reference_id)
           VALUES ($1, $2, $3, $4, $5, $6)""",
        uuid.uuid4(), r["variant_id"], r["organization_id"], change, reason, reference,
    )
