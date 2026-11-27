"""ETS / Fixed-Route Shift Roster management & automated daily duty generation."""
from __future__ import annotations

import datetime
import secrets
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select

from app.auth.dependencies import OrgContext, get_org_context
from app.core.audit import record_audit
from app.modules.operations.bookings.enums import BookingServiceType, BookingStatus, BookingType
from app.modules.operations.bookings.models import Booking
from app.modules.operations.bookings.schemas import BookingStop
from app.modules.operations.duties.models import Duty
from app.modules.operations.duties.schemas import DutyStatus
from app.modules.operations.rosters.models import ShiftRoster

router = APIRouter(prefix="/api/v1/rosters", tags=["Shift Rosters"])


class ShiftRosterCreate(BaseModel):
    customer_id: uuid.UUID
    route_code: str = Field(..., min_length=2, max_length=64)
    route_name: str = Field(..., min_length=2, max_length=128)
    booking_type: BookingType = Field(default=BookingType.ETS)
    shift_label: str = Field(..., min_length=2, max_length=64)
    shift_time: str = Field(..., pattern=r"^([01]\d|2[0-3]):[0-5]\d$", description="HH:MM (24h)")
    duration_minutes: int = Field(default=120, ge=15, le=720)
    weekdays: List[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4], description="0=Mon..6=Sun")
    pickup_address: str = Field(..., min_length=3)
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    drop_address: str = Field(..., min_length=3)
    drop_lat: Optional[float] = None
    drop_lng: Optional[float] = None
    default_driver_id: Optional[uuid.UUID] = None
    default_vehicle_id: Optional[uuid.UUID] = None
    stops: List[BookingStop] = Field(default_factory=list)
    escort_required: Optional[bool] = None


class ShiftRosterUpdate(BaseModel):
    route_name: Optional[str] = None
    shift_label: Optional[str] = None
    shift_time: Optional[str] = Field(None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    weekdays: Optional[List[int]] = None
    default_driver_id: Optional[uuid.UUID] = None
    default_vehicle_id: Optional[uuid.UUID] = None
    stops: Optional[List[BookingStop]] = None
    escort_required: Optional[bool] = None
    active: Optional[bool] = None


class ShiftRosterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organisation_id: uuid.UUID
    customer_id: uuid.UUID
    route_code: str
    route_name: str
    booking_type: str
    shift_label: str
    shift_time: str
    duration_minutes: int
    weekdays: List[int]
    pickup_address: str
    drop_address: str
    default_driver_id: Optional[uuid.UUID] = None
    default_vehicle_id: Optional[uuid.UUID] = None
    stops: List[Dict[str, Any]]
    escort_required: bool
    active: bool


class GenerateDutiesRequest(BaseModel):
    start_date: Optional[datetime.date] = None
    days_ahead: int = Field(default=7, ge=1, le=31)


class GenerateDutiesResponse(BaseModel):
    roster_id: uuid.UUID
    created_count: int
    skipped_count: int
    duty_ids: List[uuid.UUID]


def _is_night_shift(shift_time: str) -> bool:
    hour = int(shift_time.split(":")[0])
    return hour >= 20 or hour < 6


@router.post("", response_model=ShiftRosterResponse, status_code=status.HTTP_201_CREATED)
async def create_roster(
    req: ShiftRosterCreate,
    ctx: OrgContext = Depends(get_org_context),
):
    dup = (
        await ctx.db.execute(
            select(ShiftRoster.id).where(
                ShiftRoster.organisation_id == ctx.organisation_id,
                ShiftRoster.route_code == req.route_code.strip().upper(),
            )
        )
    ).first()
    if dup:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Route code already exists")

    escort = req.escort_required if req.escort_required is not None else _is_night_shift(req.shift_time)
    roster = ShiftRoster(
        id=uuid.uuid4(),
        organisation_id=ctx.organisation_id,
        customer_id=req.customer_id,
        route_code=req.route_code.strip().upper(),
        route_name=req.route_name.strip(),
        booking_type=req.booking_type.value,
        shift_label=req.shift_label.strip(),
        shift_time=req.shift_time,
        duration_minutes=req.duration_minutes,
        weekdays=sorted({d for d in req.weekdays if 0 <= d <= 6}),
        pickup_address=req.pickup_address.strip(),
        pickup_lat=req.pickup_lat,
        pickup_lng=req.pickup_lng,
        drop_address=req.drop_address.strip(),
        drop_lat=req.drop_lat,
        drop_lng=req.drop_lng,
        default_driver_id=req.default_driver_id,
        default_vehicle_id=req.default_vehicle_id,
        stops=[s.model_dump(mode="json") for s in req.stops],
        escort_required=escort,
        active=True,
    )
    ctx.db.add(roster)
    record_audit(ctx.db, ctx.organisation_id, ctx.user_id, "ROSTER_CREATED", "shift_roster", roster.id, {"route_code": roster.route_code})
    await ctx.db.commit()
    await ctx.db.refresh(roster)
    return ShiftRosterResponse.model_validate(roster)


@router.get("", response_model=List[ShiftRosterResponse])
async def list_rosters(
    active_only: bool = Query(True),
    ctx: OrgContext = Depends(get_org_context),
):
    stmt = select(ShiftRoster).where(ShiftRoster.organisation_id == ctx.organisation_id)
    if active_only:
        stmt = stmt.where(ShiftRoster.active.is_(True))
    rows = (await ctx.db.execute(stmt.order_by(ShiftRoster.shift_time.asc()))).scalars().all()
    return [ShiftRosterResponse.model_validate(r) for r in rows]


@router.patch("/{roster_id}", response_model=ShiftRosterResponse)
async def update_roster(
    roster_id: uuid.UUID,
    req: ShiftRosterUpdate,
    ctx: OrgContext = Depends(get_org_context),
):
    roster = (
        await ctx.db.execute(
            select(ShiftRoster).where(ShiftRoster.id == roster_id, ShiftRoster.organisation_id == ctx.organisation_id)
        )
    ).scalars().first()
    if not roster:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift roster not found")

    data = req.model_dump(exclude_unset=True)
    if "stops" in data and req.stops is not None:
        data["stops"] = [s.model_dump(mode="json") for s in req.stops]
    for k, v in data.items():
        setattr(roster, k, v)

    await ctx.db.commit()
    await ctx.db.refresh(roster)
    return ShiftRosterResponse.model_validate(roster)


@router.post("/{roster_id}/generate-duties", response_model=GenerateDutiesResponse)
async def generate_duties_from_roster(
    roster_id: uuid.UUID,
    req: GenerateDutiesRequest = GenerateDutiesRequest(),
    ctx: OrgContext = Depends(get_org_context),
):
    roster = (
        await ctx.db.execute(
            select(ShiftRoster).where(ShiftRoster.id == roster_id, ShiftRoster.organisation_id == ctx.organisation_id)
        )
    ).scalars().first()
    if not roster:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift roster not found")
    if not roster.active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Shift roster is inactive")

    base_date = req.start_date or datetime.date.today()
    hour, minute = (int(p) for p in roster.shift_time.split(":"))
    allowed_days = set(roster.weekdays if isinstance(roster.weekdays, list) else [])

    # IST (+05:30) default shift wall-clock unless already handled
    ist = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    created_ids: List[uuid.UUID] = []
    skipped = 0

    for offset in range(req.days_ahead):
        day = base_date + datetime.timedelta(days=offset)
        if day.weekday() not in allowed_days:
            continue

        sched_start = datetime.datetime(day.year, day.month, day.day, hour, minute, tzinfo=ist).astimezone(datetime.timezone.utc)
        sched_end = sched_start + datetime.timedelta(minutes=roster.duration_minutes)
        marker = f"ROSTER:{roster.id}:{day.isoformat()}"

        # Idempotent: skip if already generated for this roster + day
        existing = (
            await ctx.db.execute(
                select(Duty.id).where(
                    Duty.organisation_id == ctx.organisation_id,
                    Duty.notes == marker,
                ).limit(1)
            )
        ).first()
        if existing:
            skipped += 1
            continue

        b_type = BookingType(roster.booking_type) if roster.booking_type in BookingType._value2member_map_ else BookingType.ETS
        pin = str(secrets.randbelow(9000) + 1000)
        booking = Booking(
            id=uuid.uuid4(),
            booking_number=f"BK-{day.year}-{uuid.uuid4().hex[:8].upper()}",
            organisation_id=ctx.organisation_id,
            customer_id=roster.customer_id,
            booking_type=b_type,
            service_type=BookingServiceType.PASSENGER,
            pickup_address=roster.pickup_address,
            pickup_lat=roster.pickup_lat,
            pickup_lng=roster.pickup_lng,
            drop_address=roster.drop_address,
            drop_lat=roster.drop_lat,
            drop_lng=roster.drop_lng,
            pickup_datetime=sched_start,
            expected_completion_datetime=sched_end,
            passenger_info={
                "shift": roster.shift_label,
                "route_code": roster.route_code,
                "route_name": roster.route_name,
                "count": len(roster.stops) if isinstance(roster.stops, list) and roster.stops else 1,
            },
            stops=roster.stops if isinstance(roster.stops, list) else [],
            boarding_pin=pin,
            escort_required=roster.escort_required,
            status=BookingStatus.CONFIRMED,
            source="ROSTER",
            created_by_user_id=ctx.user_id,
        )
        ctx.db.add(booking)
        await ctx.db.flush()

        has_assignment = bool(roster.default_driver_id and roster.default_vehicle_id)
        duty = Duty(
            id=uuid.uuid4(),
            duty_number=f"DT-{day.year}-{uuid.uuid4().hex[:8].upper()}",
            organisation_id=ctx.organisation_id,
            booking_id=booking.id,
            driver_id=roster.default_driver_id,
            vehicle_id=roster.default_vehicle_id,
            scheduled_start_time=sched_start,
            scheduled_end_time=sched_end,
            status=DutyStatus.ASSIGNED if has_assignment else DutyStatus.UNASSIGNED,
            notes=marker,
        )
        ctx.db.add(duty)
        created_ids.append(duty.id)

    record_audit(
        ctx.db, ctx.organisation_id, ctx.user_id, "ROSTER_DUTIES_GENERATED", "shift_roster", roster.id,
        {"created_count": len(created_ids), "skipped_count": skipped},
    )
    await ctx.db.commit()
    return GenerateDutiesResponse(
        roster_id=roster.id,
        created_count=len(created_ids),
        skipped_count=skipped,
        duty_ids=created_ids,
    )
