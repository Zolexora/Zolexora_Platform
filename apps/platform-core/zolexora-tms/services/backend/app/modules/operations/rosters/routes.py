"""ETS / Fixed-Route Shift Roster management & automated daily duty generation."""
from __future__ import annotations

import csv
import datetime
import io
import secrets
import uuid
from collections import defaultdict
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


class RosterCsvImportRequest(BaseModel):
    customer_id: uuid.UUID
    csv_text: str = Field(..., min_length=10)
    default_booking_type: BookingType = Field(default=BookingType.ETS)
    default_duration_minutes: int = Field(default=120, ge=15, le=720)
    update_existing: bool = True


class RosterCsvImportResponse(BaseModel):
    created_rosters: int
    updated_rosters: int
    total_stops: int
    roster_ids: List[uuid.UUID]


_DAY_NAME_MAP = {
    "mon": 0, "monday": 0, "0": 0,
    "tue": 1, "tuesday": 1, "1": 1,
    "wed": 2, "wednesday": 2, "2": 2,
    "thu": 3, "thursday": 3, "3": 3,
    "fri": 4, "friday": 4, "4": 4,
    "sat": 5, "saturday": 5, "5": 5,
    "sun": 6, "sunday": 6, "6": 6,
}


def _parse_weekdays(raw: str | None) -> List[int]:
    if not raw or not raw.strip():
        return [0, 1, 2, 3, 4]
    days = []
    for part in raw.replace("|", ",").replace(";", ",").replace(" ", ",").split(","):
        key = part.strip().lower()
        if key in _DAY_NAME_MAP:
            days.append(_DAY_NAME_MAP[key])
    return sorted(set(days)) or [0, 1, 2, 3, 4]


def _parse_opt_float(raw: str | None) -> Optional[float]:
    if raw is None or not str(raw).strip():
        return None
    try:
        return float(str(raw).strip())
    except ValueError:
        return None


def _is_night_shift(shift_time: str) -> bool:
    try:
        hour = int(shift_time.split(":")[0])
        return hour >= 20 or hour < 6
    except (ValueError, IndexError):
        return False


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
        raw_stops = roster.stops if isinstance(roster.stops, list) else []
        daily_stops: List[Dict[str, Any]] = []
        for idx, st in enumerate(raw_stops, start=1):
            stop_copy = dict(st)
            stop_copy["seq"] = int(stop_copy.get("seq") or idx)
            stop_copy["status"] = "PENDING"
            if str(stop_copy.get("stop_type", "PICKUP")).upper() == "PICKUP" and not stop_copy.get("boarding_pin"):
                stop_copy["boarding_pin"] = str(secrets.randbelow(9000) + 1000)
            daily_stops.append(stop_copy)

        pickup_stops_count = sum(1 for st in daily_stops if str(st.get("stop_type", "PICKUP")).upper() == "PICKUP")
        pax_count = pickup_stops_count or len(daily_stops) or 1

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
                "count": pax_count,
            },
            stops=daily_stops,
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


@router.post("/import-csv", response_model=RosterCsvImportResponse, status_code=status.HTTP_200_OK)
async def import_rosters_csv(
    req: RosterCsvImportRequest,
    ctx: OrgContext = Depends(get_org_context),
):
    """Import or update ShiftRosters + ordered employee stops from a CSV payload grouped by route_code."""
    reader = csv.DictReader(io.StringIO(req.csv_text.strip()))
    if not reader.fieldnames:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty or invalid CSV header")

    grouped: Dict[str, List[Dict[str, str]]] = defaultdict(list)
    for raw_row in reader:
        row = {str(k).strip().lower(): (str(v).strip() if v is not None else "") for k, v in raw_row.items() if k}
        rc = (row.get("route_code") or "").upper()
        addr = row.get("address") or row.get("pickup_address") or ""
        if not rc or len(addr) < 3:
            continue
        row["_resolved_address"] = addr
        grouped[rc].append(row)

    if not grouped:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid rows found (requires route_code and address columns)",
        )

    created_count = 0
    updated_count = 0
    total_stops = 0
    roster_ids: List[uuid.UUID] = []

    for route_code, rows in grouped.items():
        first = rows[0]
        shift_time = first.get("shift_time") or "09:00"
        if len(shift_time) == 4 and ":" in shift_time:
            shift_time = f"0{shift_time}"
        shift_label = first.get("shift_label") or f"Shift {shift_time}"
        route_name = first.get("route_name") or route_code
        weekdays = _parse_weekdays(first.get("weekdays"))
        b_type_raw = (first.get("booking_type") or req.default_booking_type.value).upper()
        b_type = b_type_raw if b_type_raw in BookingType._value2member_map_ else req.default_booking_type.value

        escort_raw = (first.get("escort_required") or "").lower()
        escort = (
            escort_raw in {"1", "true", "yes", "y"}
            if escort_raw
            else _is_night_shift(shift_time)
        )

        stops_models: List[BookingStop] = []
        for idx, r in enumerate(rows, start=1):
            s_type = (r.get("stop_type") or "PICKUP").upper()
            if s_type not in {"PICKUP", "DROP"}:
                s_type = "PICKUP"
            stops_models.append(
                BookingStop(
                    seq=idx,
                    stop_type=s_type,
                    address=r["_resolved_address"],
                    lat=_parse_opt_float(r.get("lat")),
                    lng=_parse_opt_float(r.get("lng")),
                    contact_name=r.get("employee_name") or r.get("contact_name") or None,
                    contact_phone=r.get("phone") or r.get("contact_phone") or None,
                    employee_id=r.get("employee_id") or None,
                    boarding_pin=(r.get("boarding_pin") or None),
                )
            )
        stops_json = [s.model_dump(mode="json") for s in stops_models]
        total_stops += len(stops_json)

        pickups = [s for s in stops_models if s.stop_type == "PICKUP"]
        drops = [s for s in stops_models if s.stop_type == "DROP"]
        first_pickup = pickups[0] if pickups else stops_models[0]
        last_drop = drops[-1] if drops else None

        pickup_address = first_pickup.address
        pickup_lat = first_pickup.lat
        pickup_lng = first_pickup.lng
        drop_address = (first.get("drop_address") or (last_drop.address if last_drop else stops_models[-1].address))
        drop_lat = last_drop.lat if last_drop else None
        drop_lng = last_drop.lng if last_drop else None

        existing = (
            await ctx.db.execute(
                select(ShiftRoster).where(
                    ShiftRoster.organisation_id == ctx.organisation_id,
                    ShiftRoster.route_code == route_code,
                )
            )
        ).scalars().first()

        if existing:
            if not req.update_existing:
                roster_ids.append(existing.id)
                continue
            existing.customer_id = req.customer_id
            existing.route_name = route_name
            existing.booking_type = b_type
            existing.shift_label = shift_label
            existing.shift_time = shift_time
            existing.weekdays = weekdays
            existing.pickup_address = pickup_address
            existing.pickup_lat = pickup_lat
            existing.pickup_lng = pickup_lng
            existing.drop_address = drop_address
            existing.drop_lat = drop_lat
            existing.drop_lng = drop_lng
            existing.stops = stops_json
            existing.escort_required = escort
            existing.active = True
            updated_count += 1
            roster_ids.append(existing.id)
        else:
            roster = ShiftRoster(
                id=uuid.uuid4(),
                organisation_id=ctx.organisation_id,
                customer_id=req.customer_id,
                route_code=route_code,
                route_name=route_name,
                booking_type=b_type,
                shift_label=shift_label,
                shift_time=shift_time,
                duration_minutes=req.default_duration_minutes,
                weekdays=weekdays,
                pickup_address=pickup_address,
                pickup_lat=pickup_lat,
                pickup_lng=pickup_lng,
                drop_address=drop_address,
                drop_lat=drop_lat,
                drop_lng=drop_lng,
                stops=stops_json,
                escort_required=escort,
                active=True,
            )
            ctx.db.add(roster)
            created_count += 1
            roster_ids.append(roster.id)

    record_audit(
        ctx.db, ctx.organisation_id, ctx.user_id, "ROSTER_CSV_IMPORTED", "shift_roster", roster_ids[0],
        {"created_rosters": created_count, "updated_rosters": updated_count, "total_stops": total_stops},
    )
    await ctx.db.commit()
    return RosterCsvImportResponse(
        created_rosters=created_count,
        updated_rosters=updated_count,
        total_stops=total_stops,
        roster_ids=roster_ids,
    )
