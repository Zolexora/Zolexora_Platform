import datetime
import uuid
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import OrgContext
from app.core.audit import record_audit
from app.core.passenger_notify import notify_passengers_for_duty
from app.core.websocket import ws_manager
from app.core.push import send_duty_assigned_push, send_duty_dispatched_push
from app.modules.core.devices.models import DeviceToken
from app.modules.crm.clients.models import Client
from app.modules.fleet.drivers.models import Driver
from app.modules.fleet.vehicles.models import Vehicle
from app.modules.operations.bookings.models import Booking
from app.modules.operations.duties.models import Duty
from app.modules.operations.trips.models import Trip, TripEvent
from app.modules.operations.duties.schemas import (
    DutyAssignRequest,
    DutyBookingSummary,
    DutyCreate,
    DutyDriverSummary,
    DutyResponse,
    DutyStatus,
    DutyStopUpdateRequest,
    DutyTripSummary,
    DutyVehicleSummary,
    EscortVerifyRequest,
    SafeDropConfirmRequest,
    SlaSafetyAuditRow,
    SlaSafetyReportResponse,
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
        supervisor_id=req.supervisor_id,
        supervisor_name=req.supervisor_name.strip() if req.supervisor_name else None,
        supervisor_phone=req.supervisor_phone.strip() if req.supervisor_phone else None,
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
            pax = b.passenger_info if isinstance(b.passenger_info, dict) else {}
            raw_pax_count = pax.get("count") or pax.get("passenger_count")
            try:
                pax_count = int(raw_pax_count) if raw_pax_count not in (None, "") else None
            except (TypeError, ValueError):
                pax_count = None
            base.booking = DutyBookingSummary(
                id=b.id,
                booking_number=b.booking_number,
                booking_type=b.booking_type.value if hasattr(b.booking_type, "value") else str(b.booking_type),
                service_type=b.service_type.value if hasattr(b.service_type, "value") else str(b.service_type),
                customer_name=c.name if c else None,
                customer_phone=c.phone if c else None,
                passenger_name=pax.get("name") or pax.get("passenger_name"),
                passenger_phone=pax.get("phone") or pax.get("passenger_phone"),
                passenger_count=pax_count,
                shift_label=pax.get("shift") or pax.get("shift_label") or pax.get("flight_no"),
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
                stops=b.stops if isinstance(b.stops, list) else [],
                boarding_pin=b.boarding_pin,
                escort_required=bool(b.escort_required),
                escort_guard_name=b.escort_guard_name,
                safe_drop_confirmed_at=b.safe_drop_confirmed_at,
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
                total_distance_km=float(tr.total_distance_km) if tr.total_distance_km is not None else None,
                start_timestamp=tr.start_timestamp,
                end_timestamp=tr.end_timestamp,
                share_token=tr.share_token,
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
    duty.supervisor_id = req.supervisor_id
    duty.supervisor_name = req.supervisor_name.strip() if req.supervisor_name else None
    duty.supervisor_phone = req.supervisor_phone.strip() if req.supervisor_phone else None
    duty.status = DutyStatus.ASSIGNED
    _audit(ctx, duty, "DUTY_ASSIGNED", previous, {
        "driver_id": str(req.driver_id),
        "vehicle_id": str(req.vehicle_id),
        "supervisor_id": str(req.supervisor_id) if req.supervisor_id else None,
        "supervisor_name": duty.supervisor_name,
    })
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
        booking = (
            await ctx.db.execute(
                select(Booking).where(Booking.id == duty.booking_id, Booking.organisation_id == ctx.organisation_id)
            )
        ).scalars().first()
        if booking and booking.escort_required and not booking.safe_drop_confirmed_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="NIGHT_SHIFT_SAFE_DROP_REQUIRED: Confirm safe drop before completing an escorted night-shift duty.",
            )
        duty.actual_end_time = now
    _audit(ctx, duty, f"DUTY_{target.value}", previous)
    resp = await _commit_and_broadcast(ctx, duty, f"duty.{target.value.lower()}")
    if target in (DutyStatus.DISPATCHED, DutyStatus.ARRIVED_PICKUP):
        await notify_passengers_for_duty(
            ctx.db,
            duty,
            stage=target.value,
            actor_user_id=ctx.user_id,
            commit_audit=True,
        )
    return resp


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


async def update_duty_stop(
    ctx: OrgContext,
    duty_id: uuid.UUID,
    seq: int,
    req: DutyStopUpdateRequest,
) -> DutyResponse:
    duty = await _get(ctx, duty_id)
    booking = (
        await ctx.db.execute(
            select(Booking).where(Booking.id == duty.booking_id, Booking.organisation_id == ctx.organisation_id)
        )
    ).scalars().first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    stops = list(booking.stops) if isinstance(booking.stops, list) else []
    target_idx = next((i for i, s in enumerate(stops) if int(s.get("seq", -1)) == seq), None)
    if target_idx is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Stop seq {seq} not found on manifest")

    now = datetime.datetime.now(datetime.timezone.utc)
    updated_stop = dict(stops[target_idx])
    if req.status == "BOARDED":
        expected_pin = updated_stop.get("boarding_pin") or booking.boarding_pin
        if expected_pin and req.pin and str(req.pin).strip() != str(expected_pin).strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="BOARDING_PIN_INVALID: Entered passenger boarding PIN does not match.",
            )
    updated_stop["status"] = req.status
    if req.status == "ARRIVED":
        updated_stop["arrived_at"] = now.isoformat()
    elif req.status == "BOARDED":
        updated_stop["boarded_at"] = now.isoformat()
    elif req.status == "DROPPED":
        updated_stop["dropped_at"] = now.isoformat()
    elif req.status == "DELIVERED":
        updated_stop["delivered_at"] = now.isoformat()
    if req.pod_url:
        updated_stop["pod_url"] = req.pod_url
    if req.notes:
        updated_stop["notes"] = req.notes

    stops[target_idx] = updated_stop
    booking.stops = stops

    # Record a TripEvent if an active trip exists for this duty
    trip = (await ctx.db.execute(select(Trip).where(Trip.duty_id == duty.id))).scalars().first()
    if trip:
        ctx.db.add(
            TripEvent(
                id=uuid.uuid4(),
                trip_id=trip.id,
                event_type=f"STOP_{req.status}",
                timestamp=now,
                latitude=req.latitude,
                longitude=req.longitude,
                notes=f"Stop #{seq} ({updated_stop.get('address', '')}): {req.notes or req.status}",
            )
        )

    record_audit(
        ctx.db, ctx.organisation_id, ctx.user_id, f"DUTY_STOP_{req.status}", "duty", duty.id,
        {"seq": seq, "status": req.status},
    )
    await ctx.db.commit()
    await ws_manager.broadcast_to_org(
        ctx.organisation_id,
        "duty.stop_updated",
        {"duty_id": str(duty.id), "seq": seq, "status": req.status},
    )
    return (await enrich_duties(ctx.db, [duty]))[0]


async def verify_escort(ctx: OrgContext, duty_id: uuid.UUID, req: EscortVerifyRequest) -> DutyResponse:
    duty = await _get(ctx, duty_id)
    booking = (
        await ctx.db.execute(
            select(Booking).where(Booking.id == duty.booking_id, Booking.organisation_id == ctx.organisation_id)
        )
    ).scalars().first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    booking.escort_guard_name = req.escort_guard_name.strip()
    now = datetime.datetime.now(datetime.timezone.utc)
    trip = (await ctx.db.execute(select(Trip).where(Trip.duty_id == duty.id))).scalars().first()
    if trip:
        ctx.db.add(
            TripEvent(
                id=uuid.uuid4(),
                trip_id=trip.id,
                event_type="ESCORT_VERIFIED",
                timestamp=now,
                notes=f"Escort guard checked in: {booking.escort_guard_name}",
            )
        )
    record_audit(
        ctx.db, ctx.organisation_id, ctx.user_id, "DUTY_ESCORT_VERIFIED", "duty", duty.id,
        {"escort_guard_name": booking.escort_guard_name},
    )
    await ctx.db.commit()
    return (await enrich_duties(ctx.db, [duty]))[0]


async def confirm_safe_drop(ctx: OrgContext, duty_id: uuid.UUID, req: SafeDropConfirmRequest) -> DutyResponse:
    duty = await _get(ctx, duty_id)
    booking = (
        await ctx.db.execute(
            select(Booking).where(Booking.id == duty.booking_id, Booking.organisation_id == ctx.organisation_id)
        )
    ).scalars().first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    if booking.boarding_pin and req.pin and str(req.pin).strip() != str(booking.boarding_pin).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="BOARDING_PIN_INVALID: Entered confirmation PIN does not match.",
        )

    now = datetime.datetime.now(datetime.timezone.utc)
    booking.safe_drop_confirmed_at = now
    trip = (await ctx.db.execute(select(Trip).where(Trip.duty_id == duty.id))).scalars().first()
    if trip:
        ctx.db.add(
            TripEvent(
                id=uuid.uuid4(),
                trip_id=trip.id,
                event_type="SAFE_DROP_CONFIRMED",
                timestamp=now,
                latitude=req.latitude,
                longitude=req.longitude,
                notes=req.notes or "Night-shift passenger safe reach confirmed",
            )
        )
    record_audit(ctx.db, ctx.organisation_id, ctx.user_id, "DUTY_SAFE_DROP_CONFIRMED", "duty", duty.id)
    await ctx.db.commit()
    await ws_manager.broadcast_to_org(
        ctx.organisation_id,
        "duty.safe_drop_confirmed",
        {"duty_id": str(duty.id), "confirmed_at": now.isoformat()},
    )
    return (await enrich_duties(ctx.db, [duty]))[0]


async def notify_passengers(ctx: OrgContext, duty_id: uuid.UUID, public_origin: Optional[str] = None) -> dict:
    duty = await _get(ctx, duty_id)
    result = await notify_passengers_for_duty(
        ctx.db,
        duty,
        stage=duty.status.value,
        actor_user_id=ctx.user_id,
        public_origin=public_origin,
        commit_audit=True,
    )
    if result.get("skipped"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passenger boarding alerts apply only to PASSENGER duties.",
        )
    return result


async def get_sla_safety_report(
    ctx: OrgContext,
    *,
    date_from: Optional[datetime.datetime] = None,
    date_to: Optional[datetime.datetime] = None,
    customer_id: Optional[uuid.UUID] = None,
    booking_type: Optional[str] = None,
    limit: int = 200,
) -> SlaSafetyReportResponse:
    """Computes corporate ETS/cab on-time SLA, boarding/no-show, and night-shift safety compliance."""
    stmt = (
        select(Duty)
        .join(Booking, Booking.id == Duty.booking_id)
        .where(Duty.organisation_id == ctx.organisation_id, Duty.status != DutyStatus.CANCELLED)
    )
    if date_from:
        stmt = stmt.where(Duty.scheduled_start_time >= date_from)
    if date_to:
        stmt = stmt.where(Duty.scheduled_start_time <= date_to)
    if customer_id:
        stmt = stmt.where(Booking.customer_id == customer_id)
    if booking_type and booking_type.upper() != "ALL":
        stmt = stmt.where(Booking.booking_type == booking_type.upper())

    duties = list((await ctx.db.execute(stmt.order_by(Duty.scheduled_start_time.desc()).limit(limit))).scalars().all())
    raw_map = {duty.id: duty for duty in duties}
    enriched = await enrich_duties(ctx.db, duties)

    rows: list[SlaSafetyAuditRow] = []
    started = 0
    on_time_count = 0
    completed = 0
    escort_req = 0
    escort_ver = 0
    safe_drop_conf = 0
    total_stops = 0
    boarded_stops = 0
    dropped_stops = 0
    no_show_stops = 0

    for d in enriched:
        b = d.booking
        raw_d = raw_map.get(d.id)
        actual_start = getattr(raw_d, "actual_start_time", None) or d.start_time
        actual_end = getattr(raw_d, "actual_end_time", None) or d.end_time
        if d.status == DutyStatus.DUTY_COMPLETED:
            completed += 1

        delay_min: Optional[int] = None
        on_time: Optional[bool] = None
        if actual_start and d.scheduled_start_time:
            started += 1
            diff = int((actual_start - d.scheduled_start_time).total_seconds() // 60)
            delay_min = diff
            on_time = diff <= 15
            if on_time:
                on_time_count += 1

        b_escort = bool(b and b.escort_required)
        if b_escort:
            escort_req += 1
            if b and b.escort_guard_name:
                escort_ver += 1
            if b and b.safe_drop_confirmed_at:
                safe_drop_conf += 1

        stops = (b.stops if b and isinstance(b.stops, list) else [])
        b_cnt = sum(1 for s in stops if str(s.get("status", "")).upper() == "BOARDED")
        d_cnt = sum(1 for s in stops if str(s.get("status", "")).upper() == "DROPPED")
        ns_cnt = sum(1 for s in stops if str(s.get("status", "")).upper() == "NO_SHOW")
        total_stops += len(stops)
        boarded_stops += b_cnt
        dropped_stops += d_cnt
        no_show_stops += ns_cnt

        rows.append(
            SlaSafetyAuditRow(
                duty_id=d.id,
                duty_number=d.duty_number,
                booking_number=b.booking_number if b else None,
                booking_type=b.booking_type if b else None,
                customer_name=b.customer_name if b else None,
                driver_name=d.driver.full_name if d.driver else None,
                vehicle_registration=d.vehicle.registration_number if d.vehicle else None,
                scheduled_start_time=d.scheduled_start_time,
                actual_start_time=actual_start,
                actual_end_time=actual_end,
                delay_minutes=delay_min,
                on_time=on_time,
                escort_required=b_escort,
                escort_guard_name=b.escort_guard_name if b else None,
                safe_drop_confirmed_at=b.safe_drop_confirmed_at if b else None,
                boarded_count=b_cnt,
                dropped_count=d_cnt,
                no_show_count=ns_cnt,
                status=d.status.value if hasattr(d.status, "value") else str(d.status),
            )
        )

    on_time_pct = round((on_time_count / started) * 100.0, 1) if started > 0 else 100.0
    safety_pct = round((safe_drop_conf / escort_req) * 100.0, 1) if escort_req > 0 else 100.0

    return SlaSafetyReportResponse(
        total_duties=len(enriched),
        completed_duties=completed,
        started_duties=started,
        on_time_start_count=on_time_count,
        on_time_start_pct=on_time_pct,
        escort_required_count=escort_req,
        escort_verified_count=escort_ver,
        safe_drop_confirmed_count=safe_drop_conf,
        safety_compliance_pct=safety_pct,
        total_stops=total_stops,
        boarded_stops=boarded_stops,
        dropped_stops=dropped_stops,
        no_show_stops=no_show_stops,
        rows=rows,
    )
