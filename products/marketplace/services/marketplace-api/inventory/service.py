import uuid
import asyncpg

from .repository import InventoryRepository
from .schemas import (
    InventoryLedger,
    InventoryReservation,
    AdjustInventoryRequest,
    ReserveInventoryRequest,
)

class InventoryService:
    def __init__(self, connection: asyncpg.Connection):
        self.repository = InventoryRepository(connection)

    async def get_ledger(self, variant_id: uuid.UUID, organization_id: uuid.UUID) -> InventoryLedger | None:
        ledger = await self.repository.get_ledger(variant_id, organization_id)
        if ledger:
            return InventoryLedger.model_validate(ledger)
        return None

    async def adjust_inventory(
        self,
        variant_id: uuid.UUID,
        organization_id: uuid.UUID,
        request: AdjustInventoryRequest,
    ) -> InventoryLedger:
        ledger = await self.repository.adjust_inventory(
            variant_id=variant_id,
            organization_id=organization_id,
            amount=request.amount,
            reason=request.reason,
            reference_id=request.reference_id,
        )
        return InventoryLedger.model_validate(ledger)

    async def reserve_inventory(
        self,
        variant_id: uuid.UUID,
        organization_id: uuid.UUID,
        request: ReserveInventoryRequest,
    ) -> InventoryReservation:
        reservation = await self.repository.reserve_inventory(
            variant_id=variant_id,
            organization_id=organization_id,
            quantity=request.quantity,
            expires_at=request.expires_at,
            reference_id=request.reference_id,
        )
        return InventoryReservation.model_validate(reservation)

    async def release_expired_reservations(self) -> int:
        return await self.repository.release_expired_reservations()

    async def consume_reservation(self, reservation_id: uuid.UUID, quantity: int) -> InventoryLedger:
        ledger = await self.repository.consume_reservation(reservation_id, quantity)
        return InventoryLedger.model_validate(ledger)
