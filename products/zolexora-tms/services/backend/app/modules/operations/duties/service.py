import datetime
import uuid
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import select

from app.auth.dependencies import OrgContext
from app.core.audit import record_audit
from app.core.websocket import ws_manager
from app.modules.fleet.drivers.models import Driver
from app.modules.fleet.vehicles.models import Vehicle
from app.modules.operations.bookings.models import Booking
from app.modules.operations.duties.models import Duty
from app.modules.operations.duties.schemas import (
    DutyAssignRequest,
    DutyCreate,
    DutyResponse,
    DutyStatus,
)


async def _get(ctx: OrgContext, duty_id: uuid.UUID) -> Duty:
    res = await ctx.db.execute(select(Duty).where(Duty.id == duty_id, Duty.organisation_id == ctx.organisation_id))
    duty = res.scalars().first()
    if not duty:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Duty not found")
    return duty


async def _ensure_in_org(ctx: OrgContext, model, entity_id: uuid.UUID, label: str) -> None:
    res = await ctx.db.execute(select(model.id).where(model.id == entity_id, model.organisation_id == ctx.organisation_id))
    if not res.scalar():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} not found")


def _audit(ctx: OrgContext, duty: Duty, event: str, previous: Optional[DutyStatus], extra: Optional[dict] = None) -> None:
    record_audit(ctx.db, ctx.organisation_id, ctx.user_id, event, "duty", duty.id, {
        "duty_number": duty.duty_number,
        "previous_status": previous.value if previous else None,
        "new_status": duty.status.value,
        **(extra or {}),
    })


async def _commit_and_broadcast(ctx: OrgContext, duty: Duty, event: str) -> DutyResponse:
    await ctx.db.commit()
    await ws_manager.broadcast_to_org(
        ctx.organisation_id, event, {"duty_id": str(duty.id), "duty_number": duty.duty_number, "booking_id": str(duty.booking_id)}
    )
    return DutyResponse.model_validate(duty)


async def create_duty(ctx: OrgContext, req: DutyCreate) -> DutyResponse:
    await _ensure_in_org(ctx, Booking, req.booking_id, "Booking")
    if req.driver_id:
        await _ensure_in_org(ctx, Driver, req.driver_id, "Driver")
    if req.vehicle_id:
        await _ensure_in_org(ctx, Vehicle, req.vehicle_id, "Vehicle")

    duty = Duty(
        duty_number=f"DTY-{datetime.datetime.now().year}-{uuid.uuid4().hex[:8].upper()}",
        organisation_id=ctx.organisation_id,
        booking_id=req.booking_id,
        driver_id=req.driver_id,
        vehicle_id=req.vehicle_id,
        scheduled_start_time=req.scheduled_start_time,
        scheduled_end_time=req.scheduled_end_time,
        notes=req.notes,
        status=DutyStatus.ASSIGNED if (req.driver_id and req.vehicle_id) else DutyStatus.UNASSIGNED,
    )
    ctx.db.add(duty)
    await ctx.db.flush()
    _audit(ctx, duty, "DUTY_CREATED", None)
    return await _commit_and_broadcast(ctx, duty, "duty.created")


async def list_duties(
    ctx: OrgContext,
    status_filter: Optional[DutyStatus] = None,
    driver_id: Optional[uuid.UUID] = None,
    vehicle_id: Optional[uuid.UUID] = None,
    skip: int = 0,
    limit: int = 50,
) -> list[DutyResponse]:
    stmt = select(Duty).where(Duty.organisation_id == ctx.organisation_id)
    if status_filter:
        stmt = stmt.where(Duty.status == status_filter)
    if driver_id:
        stmt = stmt.where(Duty.driver_id == driver_id)
    if vehicle_id:
        stmt = stmt.where(Duty.vehicle_id == vehicle_id)
    stmt = stmt.order_by(Duty.created_at.desc()).limit(limit).offset(skip)
    res = await ctx.db.execute(stmt)
    return [DutyResponse.model_validate(d) for d in res.scalars().all()]


async def get_duty(ctx: OrgContext, duty_id: uuid.UUID) -> DutyResponse:
    return DutyResponse.model_validate(await _get(ctx, duty_id))


async def assign_duty(ctx: OrgContext, duty_id: uuid.UUID, req: DutyAssignRequest) -> DutyResponse:
    duty = await _get(ctx, duty_id)
    if duty.status not in (DutyStatus.UNASSIGNED, DutyStatus.CANCELLED, DutyStatus.ASSIGNED, DutyStatus.DRIVER_ACCEPTANCE_PENDING):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot assign driver to duty in status {duty.status.value}")
    await _ensure_in_org(ctx, Driver, req.driver_id, "Driver")
    await _ensure_in_org(ctx, Vehicle, req.vehicle_id, "Vehicle")

    previous = duty.status
    duty.driver_id = req.driver_id
    duty.vehicle_id = req.vehicle_id
    duty.status = DutyStatus.ASSIGNED
    _audit(ctx, duty, "DUTY_ASSIGNED", previous, {"driver_id": str(req.driver_id), "vehicle_id": str(req.vehicle_id)})
    return await _commit_and_broadcast(ctx, duty, "duty.assigned")


async def _update_duty_status(ctx: OrgContext, duty_id: uuid.UUID, target: DutyStatus, allowed: list[DutyStatus]) -> DutyResponse:
    duty = await _get(ctx, duty_id)
    if duty.status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Invalid transition from {duty.status.value} to {target.value}",
        )
    previous = duty.status
    duty.status = target
    now = datetime.datetime.now(datetime.timezone.utc)
    if target == DutyStatus.DISPATCHED:
        duty.dispatched_at = now
        duty.dispatched_by_user_id = ctx.user_id
    elif target == DutyStatus.IN_TRANSIT and not duty.actual_start_time:
        duty.actual_start_time = now
    elif target == DutyStatus.DUTY_COMPLETED:
        duty.actual_end_time = now
    _audit(ctx, duty, f"DUTY_{target.value}", previous)
    return await _commit_and_broadcast(ctx, duty, f"duty.{target.value.lower()}")


async def dispatch_duty(ctx: OrgContext, duty_id: uuid.UUID) -> DutyResponse:
    return await _update_duty_status(ctx, duty_id, DutyStatus.DISPATCHED, [DutyStatus.ASSIGNED, DutyStatus.ACCEPTED])


async def driver_accept_duty(ctx: OrgContext, duty_id: uuid.UUID) -> DutyResponse:
    return await _update_duty_status(ctx, duty_id, DutyStatus.ACCEPTED, [DutyStatus.ASSIGNED, DutyStatus.DRIVER_ACCEPTANCE_PENDING])


MILESTONE_PREVIOUS = {
    DutyStatus.ARRIVED_PICKUP: [DutyStatus.DISPATCHED],
    DutyStatus.IN_TRANSIT: [DutyStatus.ARRIVED_PICKUP],
    DutyStatus.ARRIVED_DROP: [DutyStatus.IN_TRANSIT],
    DutyStatus.DUTY_COMPLETED: [DutyStatus.ARRIVED_DROP],
}


async def update_duty_milestone(ctx: OrgContext, duty_id: uuid.UUID, target: DutyStatus) -> DutyResponse:
    return await _update_duty_status(ctx, duty_id, target, MILESTONE_PREVIOUS.get(target, []))


async def driver_reject_duty(ctx: OrgContext, duty_id: uuid.UUID, reason: Optional[str]) -> DutyResponse:
    duty = await _get(ctx, duty_id)
    if duty.status not in (DutyStatus.ASSIGNED, DutyStatus.DRIVER_ACCEPTANCE_PENDING, DutyStatus.DISPATCHED):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot reject at this stage.")
    previous = duty.status
    rejected_driver = duty.driver_id
    duty.status = DutyStatus.UNASSIGNED
    duty.driver_id = None
    duty.vehicle_id = None
    _audit(ctx, duty, "DUTY_REJECTED", previous, {"reason": reason, "driver_id": str(rejected_driver) if rejected_driver else None})
    return await _commit_and_broadcast(ctx, duty, "duty.rejected")
