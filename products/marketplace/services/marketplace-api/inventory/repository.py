import uuid
from datetime import datetime
import asyncpg


class InventoryRepository:
    """Repository for inventory operations."""

    def __init__(self, connection: asyncpg.Connection):
        self.connection = connection

    async def get_ledger(self, variant_id: uuid.UUID, organization_id: uuid.UUID) -> dict | None:
        row = await self.connection.fetchrow(
            """
            SELECT id, variant_id, organization_id, on_hand_quantity, reserved_quantity, status, created_at, updated_at
            FROM inventory_ledger
            WHERE variant_id = $1 AND organization_id = $2
            """,
            variant_id, organization_id,
        )
        return dict(row) if row else None

    async def adjust_inventory(
        self,
        variant_id: uuid.UUID,
        organization_id: uuid.UUID,
        amount: int,
        reason: str,
        reference_id: str | None,
    ) -> dict:
        if reference_id:
            existing = await self.connection.fetchrow(
                """
                SELECT id FROM inventory_audit_log
                WHERE variant_id = $1 AND organization_id = $2 AND reference_id = $3
                """,
                variant_id, organization_id, reference_id,
            )
            if existing:
                ledger = await self.get_ledger(variant_id, organization_id)
                if ledger:
                    return ledger

        ledger = await self.connection.fetchrow(
            """
            INSERT INTO inventory_ledger (id, variant_id, organization_id, on_hand_quantity, reserved_quantity)
            VALUES ($1, $2, $3, $4, 0)
            ON CONFLICT (variant_id, organization_id) DO UPDATE 
            SET on_hand_quantity = inventory_ledger.on_hand_quantity + $5,
                updated_at = now()
            RETURNING id, variant_id, organization_id, on_hand_quantity, reserved_quantity, status, created_at, updated_at
            """,
            uuid.uuid4(), variant_id, organization_id, max(0, amount), amount,
        )

        if not ledger:
            raise ValueError("Failed to adjust inventory")
            
        if ledger["on_hand_quantity"] < ledger["reserved_quantity"]:
            raise ValueError("on_hand_quantity cannot be less than reserved_quantity")
            
        if ledger["on_hand_quantity"] < 0:
            raise ValueError("on_hand_quantity cannot be less than 0")

        await self.connection.execute(
            """
            INSERT INTO inventory_audit_log (id, variant_id, organization_id, change_quantity, reason, reference_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            uuid.uuid4(), variant_id, organization_id, amount, reason, reference_id,
        )

        return dict(ledger)

    async def reserve_inventory(
        self,
        variant_id: uuid.UUID,
        organization_id: uuid.UUID,
        quantity: int,
        expires_at: datetime,
        reference_id: str | None,
    ) -> dict:
        if reference_id:
            existing = await self.connection.fetchrow(
                """
                SELECT id, variant_id, organization_id, quantity, status, expires_at, reference_id, created_at, updated_at
                FROM inventory_reservation
                WHERE variant_id = $1 AND organization_id = $2 AND reference_id = $3
                """,
                variant_id, organization_id, reference_id,
            )
            if existing:
                return dict(existing)

        updated_ledger = await self.connection.fetchrow(
            """
            UPDATE inventory_ledger
            SET reserved_quantity = reserved_quantity + $1,
                updated_at = now()
            WHERE variant_id = $2 AND organization_id = $3
              AND (on_hand_quantity - reserved_quantity) >= $1
            RETURNING id
            """,
            quantity, variant_id, organization_id,
        )

        if not updated_ledger:
            raise ValueError("Insufficient available inventory or ledger not found")

        reservation = await self.connection.fetchrow(
            """
            INSERT INTO inventory_reservation (id, variant_id, organization_id, quantity, expires_at, reference_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, variant_id, organization_id, quantity, status, expires_at, reference_id, created_at, updated_at
            """,
            uuid.uuid4(), variant_id, organization_id, quantity, expires_at, reference_id,
        )

        return dict(reservation)

    async def release_expired_reservations(self) -> int:
        rows = await self.connection.fetch(
            """
            UPDATE inventory_reservation
            SET status = 'EXPIRED', updated_at = now()
            WHERE status = 'ACTIVE' AND expires_at < now()
            RETURNING id, variant_id, organization_id, quantity
            """
        )

        count = 0
        for row in rows:
            await self.connection.execute(
                """
                UPDATE inventory_ledger
                SET reserved_quantity = reserved_quantity - $1,
                    updated_at = now()
                WHERE variant_id = $2 AND organization_id = $3
                """,
                row["quantity"], row["variant_id"], row["organization_id"],
            )
            count += 1

        return count

    async def consume_reservation(self, reservation_id: uuid.UUID, quantity: int) -> dict:
        reservation = await self.connection.fetchrow(
            """
            UPDATE inventory_reservation
            SET status = 'CONSUMED', updated_at = now()
            WHERE id = $1 AND status = 'ACTIVE'
            RETURNING id, variant_id, organization_id, quantity, reference_id
            """,
            reservation_id,
        )

        if not reservation:
            raise ValueError("Reservation not found or not active")

        await self.connection.execute(
            """
            UPDATE inventory_ledger
            SET reserved_quantity = reserved_quantity - $1,
                on_hand_quantity = on_hand_quantity - $2,
                updated_at = now()
            WHERE variant_id = $3 AND organization_id = $4
            """,
            reservation["quantity"], quantity, reservation["variant_id"], reservation["organization_id"],
        )

        await self.connection.execute(
            """
            INSERT INTO inventory_audit_log (id, variant_id, organization_id, change_quantity, reason, reference_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            uuid.uuid4(), reservation["variant_id"], reservation["organization_id"], -quantity, "Consumed reservation", reservation["reference_id"],
        )

        return await self.get_ledger(reservation["variant_id"], reservation["organization_id"])
