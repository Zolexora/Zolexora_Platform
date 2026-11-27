import datetime
from decimal import Decimal
import uuid
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUserContext, _resolve_member_permissions
from app.core.storage import upload_document_to_r2
from app.core.websocket import ws_manager
from app.modules.core.audit.models import AuditLog
from app.modules.crm.vendors.routes import find_vendor_for_caller
from app.modules.fleet.drivers.models import Driver
from app.modules.fleet.drivers.routes import find_driver_for_caller
from app.modules.fleet.vehicles.models import Vehicle
from app.modules.operations.duties.models import Duty, DutyStatus
from app.modules.operations.trips.models import Trip, TripEvent, TripStatus
from app.modules.operations.trips.schemas import (
    TripCompleteRequest,
    TripEventResponse,
    TripMilestoneRequest,
    TripReceiptAddRequest,
    TripResponse,
    TripStartRequest,
)


def _extract_coords(location: object) -> tuple[Optional[float], Optional[float]]:
    """Extracts (lat, lng) supporting both {lat, lng} and {latitude, longitude}."""
    if not isinstance(location, dict):
        return None, None
    lat = location.get("lat") if location.get("lat") is not None else location.get("latitude")
    lng = location.get("lng") if location.get("lng") is not None else location.get("longitude")
    return (float(lat) if lat is not None else None, float(lng) if lng is not None else None)


async def _ensure_loaded_permissions(ctx: CurrentUserContext, db: AsyncSession) -> None:
    if not ctx.is_business_session and not ctx.is_commander and not ctx.permissions and ctx.member_id:
        role_name, caps = await _resolve_member_permissions(db, ctx.organisation_id, ctx.member_id)
        ctx.role_code = role_name
        ctx.permissions = caps


async def _ensure_trip_tracking_write_access(
    ctx: CurrentUserContext, trip: Trip, db: AsyncSession
) -> None:
    """Only the assigned driver, commander, or dispatch/duty editors may post GPS pings."""
    await _ensure_loaded_permissions(ctx, db)
    if (
        ctx.has_permission("operations.duties.edit")
        or ctx.has_permission("operations.dispatch.assign")
    ):
        return
    if ctx.email or ctx.phone_number:
        driver = await find_driver_for_caller(db, ctx.organisation_id, ctx.email, ctx.phone_number)
        if driver and driver.id == trip.driver_id:
            return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Insufficient permissions to post tracking events for this trip",
    )


async def _ensure_trip_tracking_read_access(
    ctx: CurrentUserContext, trip: Trip, db: AsyncSession
) -> None:
    """Only tracking-permitted users, client portals, assigned driver, or owning vendor may view GPS trail."""
    await _ensure_loaded_permissions(ctx, db)
    if (
        ctx.has_permission("operations.tracking.view")
        or ctx.has_permission("operations.dispatch.view")
        or ctx.workspace_type == "CLIENT"
    ):
        return
    if ctx.email or ctx.phone_number:
        driver = await find_driver_for_caller(db, ctx.organisation_id, ctx.email, ctx.phone_number)
        if driver and driver.id == trip.driver_id:
            return
        vendor = await find_vendor_for_caller(db, ctx.organisation_id, ctx.email, ctx.phone_number)
        if vendor:
            veh = (
                await db.execute(select(Vehicle.vendor_id).where(Vehicle.id == trip.vehicle_id))
            ).scalar_one_or_none()
            drv_vendor = (
                await db.execute(select(Driver.vendor_id).where(Driver.id == trip.driver_id))
            ).scalar_one_or_none()
            if veh == vendor.id or drv_vendor == vendor.id:
                return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Insufficient permissions: 'operations.tracking.view' required",
    )


async def start_trip(
    org_id: uuid.UUID,
    duty_id: uuid.UUID,
    actor_id: uuid.UUID,
    req: TripStartRequest,
    db: AsyncSession,
) -> TripResponse:
    # 1. Fetch duty
    stmt = select(Duty).where(Duty.id == duty_id, Duty.organisation_id == org_id)
    res = await db.execute(stmt)
    duty = res.scalars().first()
    if not duty:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Duty not found")

    if not duty.driver_id or not duty.vehicle_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Duty has no assigned driver or vehicle")

    # Check if trip already started
    existing_trip_stmt = select(Trip).where(Trip.duty_id == duty.id)
    existing_trip_res = await db.execute(existing_trip_stmt)
    if existing_trip_res.scalars().first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A trip has already been initialized for this duty")

    now = datetime.datetime.now(datetime.timezone.utc)
    trip_num = f"TR-{now.year}-{uuid.uuid4().hex[:6].upper()}"

    trip = Trip(
        id=uuid.uuid4(),
        trip_number=trip_num,
        organisation_id=org_id,
        duty_id=duty.id,
        driver_id=duty.driver_id,
        vehicle_id=duty.vehicle_id,
        start_odometer=req.start_odometer,
        start_timestamp=now,
        start_location=req.start_location,
        status=TripStatus.IN_TRANSIT,
    )
    db.add(trip)

    # Record first milestone
    start_lat, start_lng = _extract_coords(req.start_location)
    event = TripEvent(
        id=uuid.uuid4(),
        trip_id=trip.id,
        event_type="TRIP_STARTED",
        timestamp=now,
        latitude=start_lat,
        longitude=start_lng,
        notes=f"Starting odometer: {req.start_odometer} KM",
    )
    db.add(event)

    # Sync duty status
    duty.status = DutyStatus.IN_TRANSIT
    duty.actual_start_time = now

    audit = AuditLog(
        id=uuid.uuid4(),
        organisation_id=org_id,
        actor_user_id=actor_id,
        action="TRIP_STARTED",
        entity_type="trip",
        entity_id=trip.id,
        metadata_={"trip_number": trip.trip_number, "start_odometer": str(req.start_odometer)},
    )
    db.add(audit)

    await db.commit()
    await db.refresh(trip)

    await ws_manager.broadcast_to_org(
        org_id,
        "trip.started",
        {"trip_id": str(trip.id), "trip_number": trip.trip_number, "duty_id": str(duty.id)},
    )

    return TripResponse.model_validate(trip)


async def complete_trip(
    org_id: uuid.UUID,
    trip_id: uuid.UUID,
    actor_id: uuid.UUID,
    req: TripCompleteRequest,
    db: AsyncSession,
) -> TripResponse:
    stmt = select(Trip).where(Trip.id == trip_id, Trip.organisation_id == org_id)
    res = await db.execute(stmt)
    trip = res.scalars().first()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

    if trip.status == TripStatus.COMPLETED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Trip is already completed")

    # Authoritative Odometer validation
    if req.end_odometer < trip.start_odometer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"ODOMETER_INVALID: Ending odometer ({req.end_odometer}) cannot be less than starting odometer ({trip.start_odometer})",
        )

    now = datetime.datetime.now(datetime.timezone.utc)
    trip.end_odometer = req.end_odometer
    trip.total_distance_km = req.end_odometer - trip.start_odometer
    trip.end_timestamp = now
    trip.end_location = req.end_location
    trip.toll_amount = req.toll_amount
    trip.fuel_amount = req.fuel_amount
    trip.parking_amount = req.parking_amount
    trip.waiting_minutes = req.waiting_minutes
    if req.pod_attachment_url:
        trip.pod_attachment_url = req.pod_attachment_url
        trip.pod_uploaded_at = now
    if req.pod_notes:
        trip.pod_notes = req.pod_notes
    if req.notes:
        trip.notes = req.notes

    trip.status = TripStatus.COMPLETED

    # Record completion milestone
    end_lat, end_lng = _extract_coords(req.end_location)
    event = TripEvent(
        id=uuid.uuid4(),
        trip_id=trip.id,
        event_type="TRIP_COMPLETED",
        timestamp=now,
        latitude=end_lat,
        longitude=end_lng,
        notes=f"Ending odometer: {req.end_odometer} KM. Distance: {trip.total_distance_km} KM",
    )
    db.add(event)

    # Sync duty
    duty_stmt = select(Duty).where(Duty.id == trip.duty_id)
    duty_res = await db.execute(duty_stmt)
    duty = duty_res.scalars().first()
    if duty:
        duty.status = DutyStatus.DUTY_COMPLETED
        duty.actual_end_time = now

    audit = AuditLog(
        id=uuid.uuid4(),
        organisation_id=org_id,
        actor_user_id=actor_id,
        action="TRIP_COMPLETED",
        entity_type="trip",
        entity_id=trip.id,
        metadata_={
            "trip_number": trip.trip_number,
            "total_distance_km": str(trip.total_distance_km),
            "toll_amount": str(trip.toll_amount),
        },
    )
    db.add(audit)

    await db.commit()
    await db.refresh(trip)

    await ws_manager.broadcast_to_org(
        org_id,
        "trip.completed",
        {
            "trip_id": str(trip.id),
            "trip_number": trip.trip_number,
            "total_distance_km": str(trip.total_distance_km),
            "duty_id": str(trip.duty_id),
        },
    )

    return TripResponse.model_validate(trip)


async def add_trip_receipt(
    org_id: uuid.UUID,
    trip_id: uuid.UUID,
    actor_id: uuid.UUID,
    req: TripReceiptAddRequest,
    db: AsyncSession,
) -> TripResponse:
    stmt = select(Trip).where(Trip.id == trip_id, Trip.organisation_id == org_id)
    res = await db.execute(stmt)
    trip = res.scalars().first()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

    receipts = list(trip.operational_receipts)
    receipts.append({
        "id": uuid.uuid4().hex,
        "type": req.receipt_type,
        "amount": str(req.amount),
        "url": req.receipt_url,
        "notes": req.notes,
        "recorded_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "recorded_by": str(actor_id),
    })
    trip.operational_receipts = receipts

    await db.commit()
    await db.refresh(trip)
    return TripResponse.model_validate(trip)


async def upload_pod(
    org_id: uuid.UUID,
    trip_id: uuid.UUID,
    file_bytes: bytes,
    file_name: str,
    content_type: str,
    notes: Optional[str],
    db: AsyncSession,
) -> str:
    stmt = select(Trip).where(Trip.id == trip_id, Trip.organisation_id == org_id)
    res = await db.execute(stmt)
    trip = res.scalars().first()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

    url = await upload_document_to_r2(
        file_bytes=file_bytes,
        file_name=file_name,
        content_type=content_type,
        folder=f"tenants/{org_id}/trips/{trip_id}/pod",
    )
    trip.pod_attachment_url = url
    trip.pod_uploaded_at = datetime.datetime.now(datetime.timezone.utc)
    if notes:
        trip.pod_notes = notes

    await db.commit()
    return url


async def get_trip(
    org_id: uuid.UUID,
    trip_id: uuid.UUID,
    db: AsyncSession,
) -> TripResponse:
    stmt = select(Trip).where(Trip.id == trip_id, Trip.organisation_id == org_id)
    res = await db.execute(stmt)
    trip = res.scalars().first()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")
    return TripResponse.model_validate(trip)


async def add_trip_event(
    ctx: CurrentUserContext,
    trip_id: uuid.UUID,
    req: TripMilestoneRequest,
    db: AsyncSession,
) -> TripEventResponse:
    """Records a TripEvent (e.g. location_update) for an in-progress trip and broadcasts GPS updates."""
    stmt = select(Trip).where(Trip.id == trip_id, Trip.organisation_id == ctx.organisation_id)
    res = await db.execute(stmt)
    trip = res.scalars().first()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

    await _ensure_trip_tracking_write_access(ctx, trip, db)

    event_kwargs: dict = {
        "trip_id": trip_id,
        "event_type": req.event_type,
        "latitude": req.latitude,
        "longitude": req.longitude,
        "notes": req.notes,
    }
    if req.timestamp is not None:
        event_kwargs["timestamp"] = (
            req.timestamp
            if req.timestamp.tzinfo is not None
            else req.timestamp.replace(tzinfo=datetime.timezone.utc)
        )

    event = TripEvent(**event_kwargs)
    db.add(event)
    await db.commit()
    await db.refresh(event)

    if event.latitude is not None and event.longitude is not None:
        await ws_manager.broadcast_to_org(
            ctx.organisation_id,
            "trip.location",
            {
                "trip_id": str(trip.id),
                "duty_id": str(trip.duty_id),
                "event_type": event.event_type,
                "latitude": event.latitude,
                "longitude": event.longitude,
                "timestamp": event.timestamp.isoformat(),
            },
        )

    return TripEventResponse.model_validate(event)


async def list_trip_events(
    ctx: CurrentUserContext,
    trip_id: uuid.UUID,
    db: AsyncSession,
    event_type: Optional[str] = None,
    limit: int = 50,
) -> list[TripEventResponse]:
    """Lists TripEvents newest-first for users with tracking permission or trip ownership."""
    stmt = select(Trip).where(Trip.id == trip_id, Trip.organisation_id == ctx.organisation_id)
    res = await db.execute(stmt)
    trip = res.scalars().first()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

    await _ensure_trip_tracking_read_access(ctx, trip, db)

    ev_stmt = select(TripEvent).where(TripEvent.trip_id == trip_id)
    if event_type:
        ev_stmt = ev_stmt.where(TripEvent.event_type == event_type)
    ev_stmt = ev_stmt.order_by(desc(TripEvent.timestamp)).limit(limit)
    ev_res = await db.execute(ev_stmt)
    return [TripEventResponse.model_validate(e) for e in ev_res.scalars().all()]


async def list_trips(
    org_id: uuid.UUID,
    db: AsyncSession,
    status_filter: Optional[TripStatus] = None,
    limit: int = 50,
    offset: int = 0,
) -> list[TripResponse]:
    stmt = select(Trip).where(Trip.organisation_id == org_id)
    if status_filter:
        stmt = stmt.where(Trip.status == status_filter)
    stmt = stmt.order_by(desc(Trip.created_at)).limit(limit).offset(offset)
    res = await db.execute(stmt)
    return [TripResponse.model_validate(t) for t in res.scalars().all()]

