"""FASTag Toll Auto-Sync & Trip Reconciliation routes.

POST /api/v1/integrations/fastag/sync
  - Ingests FASTag deductions (via NHAI/NETC aggregator or manual sync),
    matches vehicle by fastag_id or registration_number, links active/overlapping
    Trip, flags potential double charges (same plaza within 15 minutes), and
    broadcasts `fastag.toll_synced` on the org WebSocket channel.

GET /api/v1/integrations/fastag/trips/{trip_id}/reconciliation
  - Compares auto-synced FASTag total vs driver manual `Trip.toll_amount`,
    returning variance and any duplicate charge flags.

GET /api/v1/integrations/fastag/transactions
  - Lists FASTag transactions for the organisation.
"""
from __future__ import annotations

import datetime
import uuid
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import desc, or_, select

from app.auth.dependencies import OrgContext, get_org_context
from app.core.websocket import ws_manager
from app.modules.fleet.vehicles.models import Vehicle
from app.modules.integrations.fastag.models import FastagTransaction
from app.modules.operations.trips.models import Trip

router = APIRouter(prefix="/api/v1/integrations/fastag", tags=["FASTag"])


class FastagSyncItem(BaseModel):
    transaction_ref: str = Field(..., min_length=3, max_length=128)
    fastag_id: Optional[str] = None
    registration_number: Optional[str] = None
    plaza_name: str = Field(..., min_length=2, max_length=256)
    amount: Decimal = Field(..., ge=Decimal("0.01"))
    transacted_at: datetime.datetime
    raw_payload: Dict[str, Any] = Field(default_factory=dict)


class FastagTransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    vehicle_id: Optional[uuid.UUID] = None
    trip_id: Optional[uuid.UUID] = None
    transaction_ref: str
    plaza_name: str
    amount: Decimal
    transacted_at: datetime.datetime
    duplicate_flag: bool
    reconciled: bool


class FastagReconciliationResponse(BaseModel):
    trip_id: uuid.UUID
    trip_number: str
    driver_manual_toll: Decimal
    fastag_synced_toll: Decimal
    variance: Decimal
    duplicate_count: int
    transactions: List[FastagTransactionResponse]


@router.post("/sync", response_model=FastagTransactionResponse, status_code=status.HTTP_201_CREATED)
async def sync_fastag_transaction(
    req: FastagSyncItem,
    ctx: OrgContext = Depends(get_org_context),
):
    existing = (
        await ctx.db.execute(
            select(FastagTransaction).where(
                FastagTransaction.organisation_id == ctx.organisation_id,
                FastagTransaction.transaction_ref == req.transaction_ref,
            )
        )
    ).scalars().first()
    if existing:
        return FastagTransactionResponse.model_validate(existing)

    vehicle: Optional[Vehicle] = None
    if req.fastag_id or req.registration_number:
        conds = []
        if req.fastag_id:
            conds.append(Vehicle.fastag_id == req.fastag_id.strip())
        if req.registration_number:
            conds.append(Vehicle.registration_number == req.registration_number.strip().upper())
        vehicle = (
            await ctx.db.execute(
                select(Vehicle).where(Vehicle.organisation_id == ctx.organisation_id, or_(*conds))
            )
        ).scalars().first()

    tx_time = req.transacted_at if req.transacted_at.tzinfo else req.transacted_at.replace(tzinfo=datetime.timezone.utc)
    matched_trip: Optional[Trip] = None
    duplicate_flag = False

    if vehicle:
        # Match overlapping trip for this vehicle
        trip_stmt = (
            select(Trip)
            .where(
                Trip.organisation_id == ctx.organisation_id,
                Trip.vehicle_id == vehicle.id,
                Trip.start_timestamp <= tx_time,
                or_(Trip.end_timestamp.is_(None), Trip.end_timestamp >= tx_time),
            )
            .order_by(desc(Trip.start_timestamp))
            .limit(1)
        )
        matched_trip = (await ctx.db.execute(trip_stmt)).scalars().first()

        # Detect double charge: same vehicle & same plaza within +/- 15 min
        window_start = tx_time - datetime.timedelta(minutes=15)
        window_end = tx_time + datetime.timedelta(minutes=15)
        dup = (
            await ctx.db.execute(
                select(FastagTransaction.id).where(
                    FastagTransaction.organisation_id == ctx.organisation_id,
                    FastagTransaction.vehicle_id == vehicle.id,
                    FastagTransaction.plaza_name == req.plaza_name.strip(),
                    FastagTransaction.transacted_at >= window_start,
                    FastagTransaction.transacted_at <= window_end,
                ).limit(1)
            )
        ).first()
        duplicate_flag = dup is not None

    tx = FastagTransaction(
        id=uuid.uuid4(),
        organisation_id=ctx.organisation_id,
        vehicle_id=vehicle.id if vehicle else None,
        trip_id=matched_trip.id if matched_trip else None,
        transaction_ref=req.transaction_ref.strip(),
        plaza_name=req.plaza_name.strip(),
        amount=req.amount,
        transacted_at=tx_time,
        duplicate_flag=duplicate_flag,
        reconciled=matched_trip is not None and not duplicate_flag,
        raw_payload=req.raw_payload,
    )
    ctx.db.add(tx)
    await ctx.db.commit()
    await ctx.db.refresh(tx)

    await ws_manager.broadcast_to_org(
        ctx.organisation_id,
        "fastag.toll_synced",
        {
            "transaction_id": str(tx.id),
            "trip_id": str(matched_trip.id) if matched_trip else None,
            "plaza_name": tx.plaza_name,
            "amount": float(tx.amount),
            "duplicate_flag": duplicate_flag,
        },
    )
    return FastagTransactionResponse.model_validate(tx)


@router.get("/transactions", response_model=List[FastagTransactionResponse])
async def list_fastag_transactions(
    trip_id: Optional[uuid.UUID] = None,
    vehicle_id: Optional[uuid.UUID] = None,
    limit: int = Query(50, ge=1, le=200),
    ctx: OrgContext = Depends(get_org_context),
):
    stmt = select(FastagTransaction).where(FastagTransaction.organisation_id == ctx.organisation_id)
    if trip_id:
        stmt = stmt.where(FastagTransaction.trip_id == trip_id)
    if vehicle_id:
        stmt = stmt.where(FastagTransaction.vehicle_id == vehicle_id)
    rows = (await ctx.db.execute(stmt.order_by(desc(FastagTransaction.transacted_at)).limit(limit))).scalars().all()
    return [FastagTransactionResponse.model_validate(r) for r in rows]


@router.get("/trips/{trip_id}/reconciliation", response_model=FastagReconciliationResponse)
async def get_trip_fastag_reconciliation(
    trip_id: uuid.UUID,
    ctx: OrgContext = Depends(get_org_context),
):
    trip = (
        await ctx.db.execute(select(Trip).where(Trip.id == trip_id, Trip.organisation_id == ctx.organisation_id))
    ).scalars().first()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

    txs = (
        await ctx.db.execute(
            select(FastagTransaction)
            .where(
                FastagTransaction.organisation_id == ctx.organisation_id,
                FastagTransaction.trip_id == trip_id,
            )
            .order_by(FastagTransaction.transacted_at.asc())
        )
    ).scalars().all()

    synced_sum = sum((tx.amount for tx in txs), Decimal("0.00"))
    manual_toll = trip.toll_amount or Decimal("0.00")
    return FastagReconciliationResponse(
        trip_id=trip.id,
        trip_number=trip.trip_number,
        driver_manual_toll=manual_toll,
        fastag_synced_toll=synced_sum,
        variance=manual_toll - synced_sum,
        duplicate_count=sum(1 for tx in txs if tx.duplicate_flag),
        transactions=[FastagTransactionResponse.model_validate(tx) for tx in txs],
    )
