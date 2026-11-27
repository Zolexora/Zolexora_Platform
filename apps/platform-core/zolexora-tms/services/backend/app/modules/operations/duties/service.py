import datetime
import uuid
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import OrgContext
from app.core.audit import record_audit
from app.core.websocket import ws_manager
from app.core.push import send_duty_assigned_push, send_duty_dispatched_push
from app.modules.core.devices.models import DeviceToken
from app.modules.crm.clients.models import Client
from app.modules.fleet.drivers.models import Driver
from app.modules.fleet.vehicles.models import Vehicle
from app.modules.operations.bookings.models import Booking
from app.modules.operations.duties.models import Duty
from app.modules.operations.trips.models import Trip
from app.modules.operations.duties.schemas import (
    DutyAssignRequest,
    DutyBookingSummary,
    DutyCreate,
    DutyDriverSummary,
    DutyResponse,
    DutyStatus,
    DutyTripSummary,
    DutyVehicleSummary,
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
    # Fire-and-forget push to the assigned driver (if any token registered)
    if duty.driver_id and event in ("duty.assigned", "duty.dispatched"):
        await _push_to_driver(ctx, duty, event)
    return DutyResponse.model_validate(duty)


async def _push_to_driver(ctx: OrgContext, duty: Duty, event: str) -> None:
    """Look up the driver's push token and send a notification. Best-effort."""
    try:
        # driver_id is the Profile UUID; DeviceToken.user_id maps to the same identity
        stmt = select(DeviceToken).where(DeviceToken.user_id == duty.driver_id).limit(1)
        result = await ctx.db.execute(stmt)
        row = result.scalars().first()
        if not row:
            return
        if event == "duty.assigned":
            await send_duty_assigned_push(
                driver_token=row.token,
                duty_number=duty.duty_number,
                duty_id=str(duty.id),
            )
        elif event == "duty.dispatched":
            await send_duty_dispatched_push(
                driver_token=row.token,
                duty_number=duty.duty_number,
                duty_id=str(duty.id),
            )
    except Exception as exc:  # pragma: no cover
        import logging
        logging.getLogger("zolexora.duties").warning("Push failed for duty %s: %s", duty.id, exc)


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


async def enrich_duties(db: AsyncSession, duties: list[Duty]) -> list[DutyResponse]:
    """Batch-hydrates booking/client, vehicle, driver, and trip summaries without N+1 queries."""
    if not duties:
        return []

    booking_ids = {d.booking_id for d in duties if d.booking_id}
    vehicle_ids = {d.vehicle_id for d in duties if d.vehicle_id}
    driver_ids = {d.driver_id for d in duties if d.driver_id}
    duty_ids = [d.id for d in duties]

    bookings_map: dict[uuid.UUID, Booking] = {}
    clients_map: dict[uuid.UUID, Client] = {}
    vehicles_map: dict[uuid.UUID, Vehicle] = {}
    drivers_map: dict[uuid.UUID, Driver] = {}
    trips_map: dict[uuid.UUID, Trip] = {}

    if booking_ids:
        b_rows = (await db.execute(select(Booking).where(Booking.id.in_(booking_ids)))).scalars().all()
        bookings_map = {b.id: b for b in b_rows}
        client_ids = {b.customer_id for b in b_rows if b.customer_id}
        if client_ids:
            c_rows = (await db.execute(select(Client).where(Client.id.in_(client_ids)))).scalars().all()
            clients_map = {c.id: c for c in c_rows}

    if vehicle_ids:
        v_rows = (await db.execute(select(Vehicle).where(Vehicle.id.in_(vehicle_ids)))).scalars().all()
        vehicles_map = {v.id: v for v in v_rows}

    if driver_ids:
        d_rows = (await db.execute(select(Driver).where(Driver.id.in_(driver_ids)))).scalars().all()
        drivers_map = {dr.id: dr for dr in d_rows}

    t_rows = (await db.execute(select(Trip).where(Trip.duty_id.in_(duty_ids)))).scalars().all()
    trips_map = {t.duty_id: t for t in t_rows}

    enriched: list[DutyResponse] = []
    for d in duties:
        base = DutyResponse.model_validate(d)
        b = bookings_map.get(d.booking_id)
        if b:
            c = clients_map.get(b.customer_id)
            cargo = b.cargo_info if isinstance(b.cargo_info, dict) else {}
            raw_weight = cargo.get("weight_kg")
            try:
                weight_kg = float(raw_weight) if raw_weight not in (None, "") else None
            except (TypeError, ValueError):
                weight_kg = None
            base.booking = DutyBookingSummary(
                id=b.id,
                booking_number=b.booking_number,
                customer_name=c.name if c else None,
                customer_phone=c.phone if c else None,
                pickup_address=b.pickup_address,
                pickup_lat=b.pickup_lat,
                pickup_lng=b.pickup_lng,
                drop_address=b.drop_address,
                drop_lat=b.drop_lat,
                drop_lng=b.drop_lng,
                pickup_datetime=b.pickup_datetime,
                cargo_description=cargo.get("material") or cargo.get("description"),
                cargo_weight_kg=weight_kg,
                special_instructions=b.operational_instructions,
                eway_bill_number=b.eway_bill_number,
                eway_bill_valid_until=b.eway_bill_valid_until,
            )

        v = vehicles_map.get(d.vehicle_id) if d.vehicle_id else None
        if v:
            base.vehicle = DutyVehicleSummary(
                id=v.id,
                registration_number=v.registration_number,
                make=v.make,
                model=v.model,
                fuel_type=v.fuel_type.value if hasattr(v.fuel_type, "value") else str(v.fuel_type),
                odometer_km=float(v.odometer_km) if v.odometer_km is not None else None,
                vendor_id=v.vendor_id,
            )

        dr = drivers_map.get(d.driver_id) if d.driver_id else None
        if dr:
            base.driver = DutyDriverSummary(
                id=dr.id,
                full_name=dr.full_name,
                phone=dr.phone,
                vendor_id=dr.vendor_id,
            )

        tr = trips_map.get(d.id)
        if tr:
            base.trip = DutyTripSummary(
                id=tr.id,
                trip_number=tr.trip_number,
                status=tr.status.value if hasattr(tr.status, "value") else str(tr.status),
                start_odometer=float(tr.start_odometer),
                end_odometer=float(tr.end_odometer) if tr.end_odometer is not None else None,
                toll_amount=float(tr.toll_amount),
                fuel_amount=float(tr.fuel_amount),
                parking_amount=float(tr.parking_amount),
                waiting_minutes=tr.waiting_minutes,
                pod_attachment_url=tr.pod_attachment_url,
                pod_notes=tr.pod_notes,
                operational_receipts=list(tr.operational_receipts or []),
            )
        enriched.append(base)
    return enriched


async def list_duties(
    ctx: OrgContext,
    status_filter: Optional[DutyStatus] = None,
    driver_id: Optional[uuid.UUID] = None,
    vehicle_id: Optional[uuid.UUID] = None,
    vendor_id: Optional[uuid.UUID] = None,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    date_from: Optional[datetime.datetime] = None,
    date_to: Optional[datetime.datetime] = None,
) -> list[DutyResponse]:
    stmt = select(Duty).where(Duty.organisation_id == ctx.organisation_id)
    if status_filter:
        stmt = stmt.where(Duty.status == status_filter)
    if driver_id:
        stmt = stmt.where(Duty.driver_id == driver_id)
    if vehicle_id:
        stmt = stmt.where(Duty.vehicle_id == vehicle_id)
    if vendor_id:
        vendor_vehicles = select(Vehicle.id).where(Vehicle.organisation_id == ctx.organisation_id, Vehicle.vendor_id == vendor_id)
        vendor_drivers = select(Driver.id).where(Driver.organisation_id == ctx.organisation_id, Driver.vendor_id == vendor_id)
        stmt = stmt.where(or_(Duty.vehicle_id.in_(vendor_vehicles), Duty.driver_id.in_(vendor_drivers)))
    if date_from:
        stmt = stmt.where(Duty.scheduled_start_time >= date_from)
    if date_to:
        stmt = stmt.where(Duty.scheduled_start_time <= date_to)
    if search and search.strip():
        q = f"%{search.strip()}%"
        matching_bookings = select(Booking.id).where(
            Booking.organisation_id == ctx.organisation_id,
            or_(
                Booking.booking_number.ilike(q),
                Booking.pickup_address.ilike(q),
                Booking.drop_address.ilike(q),
            ),
        )
        matching_vehicles = select(Vehicle.id).where(
            Vehicle.organisation_id == ctx.organisation_id,
            Vehicle.registration_number.ilike(q),
        )
        matching_drivers = select(Driver.id).where(
            Driver.organisation_id == ctx.organisation_id,
            Driver.full_name.ilike(q),
        )
        stmt = stmt.where(
            or_(
                Duty.duty_number.ilike(q),
                Duty.booking_id.in_(matching_bookings),
                Duty.vehicle_id.in_(matching_vehicles),
                Duty.driver_id.in_(matching_drivers),
            )
        )
    stmt = stmt.order_by(Duty.created_at.desc()).limit(limit).offset(skip)
    res = await ctx.db.execute(stmt)
    return await enrich_duties(ctx.db, list(res.scalars().all()))


async def get_duty(ctx: OrgContext, duty_id: uuid.UUID) -> DutyResponse:
    duty = await _get(ctx, duty_id)
    return (await enrich_duties(ctx.db, [duty]))[0]


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
