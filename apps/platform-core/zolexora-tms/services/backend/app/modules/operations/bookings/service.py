import datetime
import secrets
import uuid
from typing import Any, Optional
from fastapi import HTTPException, status
from pydantic import ValidationError
from sqlalchemy import select

from app.auth.dependencies import OrgContext
from app.core.audit import record_audit
from app.core.geocoding import geocoding_service
from app.core.websocket import ws_manager
from app.modules.crm.clients.models import Client
from app.modules.operations.bookings.models import Booking
from app.modules.operations.bookings.schemas import (
    BookingBulkCreateResponse,
    BookingBulkItemError,
    BookingCreate,
    BookingResponse,
    BookingStatus,
)


def new_booking_number() -> str:
    return f"BK-{datetime.datetime.now().year}-{uuid.uuid4().hex[:8].upper()}"


def passenger_safety_defaults(
    service_type_value: str,
    pickup_datetime: datetime.datetime,
    existing_pin: Optional[str] = None,
    existing_escort: Optional[bool] = None,
) -> tuple[Optional[str], bool]:
    """Return (boarding_pin, escort_required) defaults for PASSENGER bookings."""
    pin = existing_pin
    if not pin and service_type_value == "PASSENGER":
        pin = str(secrets.randbelow(9000) + 1000)
    escort = existing_escort
    if escort is None:
        # Night-shift IST (20:00 to 06:00) defaults to escort_required for PASSENGER trips
        ist = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
        aware_dt = pickup_datetime if pickup_datetime.tzinfo else pickup_datetime.replace(tzinfo=datetime.timezone.utc)
        local_dt = aware_dt.astimezone(ist)
        escort = service_type_value == "PASSENGER" and (local_dt.hour >= 20 or local_dt.hour < 6)
    return pin, escort


async def ensure_customer(ctx: OrgContext, customer_id: uuid.UUID) -> None:
    res = await ctx.db.execute(
        select(Client.id).where(Client.id == customer_id, Client.organisation_id == ctx.organisation_id)
    )
    if not res.scalar():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found in organisation")


async def _get(ctx: OrgContext, booking_id: uuid.UUID) -> Booking:
    res = await ctx.db.execute(
        select(Booking).where(Booking.id == booking_id, Booking.organisation_id == ctx.organisation_id)
    )
    booking = res.scalars().first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    return booking


async def create_booking(ctx: OrgContext, req: BookingCreate) -> BookingResponse:
    await ensure_customer(ctx, req.customer_id)

    p_lat, p_lng = req.pickup_lat, req.pickup_lng
    if p_lat is None or p_lng is None:
        p_geo = await geocoding_service.geocode(req.pickup_address)
        if p_geo:
            p_lat, p_lng = p_geo.latitude, p_geo.longitude

    d_lat, d_lng = req.drop_lat, req.drop_lng
    if d_lat is None or d_lng is None:
        d_geo = await geocoding_service.geocode(req.drop_address)
        if d_geo:
            d_lat, d_lng = d_geo.latitude, d_geo.longitude

    data = req.model_dump()
    pin, escort = passenger_safety_defaults(
        req.service_type.value,
        req.pickup_datetime,
        existing_pin=data.get("boarding_pin"),
        existing_escort=data.get("escort_required"),
    )
    data["boarding_pin"] = pin
    data["escort_required"] = escort
    data.update(
        pickup_address=req.pickup_address.strip(),
        drop_address=req.drop_address.strip(),
        pickup_lat=p_lat, pickup_lng=p_lng, drop_lat=d_lat, drop_lng=d_lng,
    )
    booking = Booking(
        **data,
        booking_number=new_booking_number(),
        organisation_id=ctx.organisation_id,
        status=BookingStatus.CONFIRMED,
        created_by_user_id=ctx.user_id,
    )
    ctx.db.add(booking)
    await ctx.db.flush()
    record_audit(ctx.db, ctx.organisation_id, ctx.user_id, "BOOKING_CREATED", "booking", booking.id,
                 {"booking_number": booking.booking_number, "customer_id": str(req.customer_id)})
    await ctx.db.commit()

    await ws_manager.broadcast_to_org(
        ctx.organisation_id,
        "booking.created",
        {"booking_id": str(booking.id), "booking_number": booking.booking_number, "customer_id": str(req.customer_id)},
    )
    return BookingResponse.model_validate(booking)


def _parse_bulk_datetime(val: Any) -> datetime.datetime:
    if isinstance(val, datetime.datetime):
        return val if val.tzinfo else val.replace(tzinfo=datetime.timezone.utc)
    s = str(val).strip()
    if not s:
        raise ValueError("pickup_datetime is required")
    # Support "YYYY-MM-DD HH:MM" and ISO formats
    normalized = s.replace(" ", "T", 1) if len(s) >= 16 and s[10] == " " else s
    dt = datetime.datetime.fromisoformat(normalized)
    if dt.tzinfo is None:
        ist = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
        dt = dt.replace(tzinfo=ist)
    return dt


async def bulk_create_bookings(
    ctx: OrgContext,
    items: list[dict[str, Any]],
) -> BookingBulkCreateResponse:
    clients_rows = (
        await ctx.db.execute(
            select(Client.id, Client.name, Client.client_code).where(Client.organisation_id == ctx.organisation_id)
        )
    ).all()

    by_id: dict[str, uuid.UUID] = {str(r.id): r.id for r in clients_rows}
    by_code: dict[str, uuid.UUID] = {r.client_code.strip().upper(): r.id for r in clients_rows if r.client_code}
    by_name: dict[str, uuid.UUID] = {r.name.strip().lower(): r.id for r in clients_rows if r.name}

    created_bookings: list[Booking] = []
    errors: list[BookingBulkItemError] = []

    for idx, raw in enumerate(items, start=1):
        cleaned = {
            k: (v.strip() if isinstance(v, str) else v)
            for k, v in raw.items()
            if not (isinstance(v, str) and v.strip() == "")
        }
        ref = str(
            cleaned.get("customer_name")
            or cleaned.get("client_code")
            or cleaned.get("customer_id")
            or cleaned.get("pickup_address")
            or ""
        ).strip() or None

        # Resolve customer_id from UUID, client_code, or client name
        resolved_cid: Optional[uuid.UUID] = None
        if cleaned.get("customer_id"):
            resolved_cid = by_id.get(str(cleaned["customer_id"]).strip())
        if not resolved_cid and cleaned.get("client_code"):
            resolved_cid = by_code.get(str(cleaned["client_code"]).strip().upper())
        if not resolved_cid and cleaned.get("customer_name"):
            key = str(cleaned["customer_name"]).strip()
            resolved_cid = by_code.get(key.upper()) or by_name.get(key.lower())

        if not resolved_cid:
            errors.append(BookingBulkItemError(row=idx, reference=ref, error="Customer not found in organisation (check Client Name or Code)"))
            continue

        try:
            pickup_dt = _parse_bulk_datetime(cleaned.get("pickup_datetime", ""))
        except Exception:
            errors.append(BookingBulkItemError(row=idx, reference=ref, error="Invalid pickup_datetime (use YYYY-MM-DD HH:MM or ISO)"))
            continue

        svc_type = str(cleaned.get("service_type") or "PASSENGER").upper()
        pax_info = dict(cleaned.get("passenger_info") or {})
        if svc_type == "PASSENGER":
            if cleaned.get("passenger_name"):
                pax_info["name"] = str(cleaned["passenger_name"])
            if cleaned.get("passenger_phone"):
                pax_info["phone"] = str(cleaned["passenger_phone"])
            if cleaned.get("passenger_count") is not None:
                try:
                    pax_info["count"] = int(cleaned["passenger_count"])
                except (TypeError, ValueError):
                    pass
            if cleaned.get("shift_label"):
                pax_info["shift"] = str(cleaned["shift_label"])

        cargo_info = dict(cleaned.get("cargo_info") or {})
        if svc_type == "CARGO":
            if cleaned.get("cargo_material"):
                cargo_info["material"] = str(cleaned["cargo_material"])
            if cleaned.get("cargo_weight_kg") is not None:
                try:
                    cargo_info["weight_kg"] = float(cleaned["cargo_weight_kg"])
                except (TypeError, ValueError):
                    pass

        payload = {
            "customer_id": resolved_cid,
            "booking_type": str(cleaned.get("booking_type") or "ETS").upper(),
            "service_type": svc_type,
            "pickup_address": cleaned.get("pickup_address", ""),
            "drop_address": cleaned.get("drop_address", ""),
            "pickup_datetime": pickup_dt,
            "passenger_info": pax_info,
            "cargo_info": cargo_info,
            "operational_instructions": cleaned.get("operational_instructions"),
            "eway_bill_number": cleaned.get("eway_bill_number"),
            "source": "BULK_CSV",
        }
        try:
            req = BookingCreate.model_validate(payload)
        except ValidationError as exc:
            msg = "; ".join(f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors())
            errors.append(BookingBulkItemError(row=idx, reference=ref, error=msg))
            continue

        data = req.model_dump()
        pin, escort = passenger_safety_defaults(
            req.service_type.value,
            req.pickup_datetime,
            existing_pin=data.get("boarding_pin"),
            existing_escort=data.get("escort_required"),
        )
        data["boarding_pin"] = pin
        data["escort_required"] = escort
        data.update(
            pickup_address=req.pickup_address.strip(),
            drop_address=req.drop_address.strip(),
        )
        booking = Booking(
            **data,
            booking_number=new_booking_number(),
            organisation_id=ctx.organisation_id,
            status=BookingStatus.CONFIRMED,
            created_by_user_id=ctx.user_id,
        )
        ctx.db.add(booking)
        created_bookings.append(booking)

    if created_bookings:
        await ctx.db.flush()
        for b in created_bookings:
            record_audit(
                ctx.db, ctx.organisation_id, ctx.user_id, "BOOKING_CREATED", "booking", b.id,
                {"booking_number": b.booking_number, "customer_id": str(b.customer_id), "source": "BULK_CSV"},
            )
        await ctx.db.commit()
        for b in created_bookings:
            await ctx.db.refresh(b)
        await ws_manager.broadcast_to_org(
            ctx.organisation_id,
            "bookings.bulk_created",
            {"count": len(created_bookings)},
        )

    return BookingBulkCreateResponse(
        created_count=len(created_bookings),
        failed_count=len(errors),
        created=[BookingResponse.model_validate(b) for b in created_bookings],
        errors=errors,
    )


async def list_bookings(
    ctx: OrgContext,
    status_filter: Optional[BookingStatus] = None,
    customer_id: Optional[uuid.UUID] = None,
    skip: int = 0,
    limit: int = 50,
) -> list[BookingResponse]:
    stmt = select(Booking).where(Booking.organisation_id == ctx.organisation_id)
    if status_filter:
        stmt = stmt.where(Booking.status == status_filter)
    if customer_id:
        stmt = stmt.where(Booking.customer_id == customer_id)
    stmt = stmt.order_by(Booking.created_at.desc()).limit(limit).offset(skip)
    res = await ctx.db.execute(stmt)
    return [BookingResponse.model_validate(b) for b in res.scalars().all()]


async def get_booking(ctx: OrgContext, booking_id: uuid.UUID) -> BookingResponse:
    return BookingResponse.model_validate(await _get(ctx, booking_id))


async def cancel_booking(ctx: OrgContext, booking_id: uuid.UUID, reason: Optional[str]) -> BookingResponse:
    booking = await _get(ctx, booking_id)
    if booking.status in (BookingStatus.COMPLETED, BookingStatus.CANCELLED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel booking with status '{booking.status.value}'.",
        )
    previous = booking.status
    booking.status = BookingStatus.CANCELLED
    record_audit(ctx.db, ctx.organisation_id, ctx.user_id, "BOOKING_CANCELLED", "booking", booking.id,
                 {"booking_number": booking.booking_number, "previous_status": previous.value, "reason": reason})
    await ctx.db.commit()

    await ws_manager.broadcast_to_org(
        ctx.organisation_id,
        "booking.cancelled",
        {"booking_id": str(booking.id), "booking_number": booking.booking_number},
    )
    return BookingResponse.model_validate(booking)


def _validate_eway_bill_format(eway_bill_number: str) -> str:
    cleaned = eway_bill_number.strip().replace("-", "").replace(" ", "")
    if not cleaned.isdigit() or len(cleaned) != 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="EWAY_BILL_INVALID: GST e-Way Bill number must be a valid 12-digit NIC number.",
        )
    return cleaned


async def _notify_eway_bill_alert(ctx: OrgContext, booking: Booking, hours_left: float) -> None:
    payload = {
        "booking_id": str(booking.id),
        "booking_number": booking.booking_number,
        "eway_bill_number": booking.eway_bill_number,
        "hours_left": round(hours_left, 1),
        "expired": hours_left <= 0,
    }
    await ws_manager.broadcast_to_org(ctx.organisation_id, "eway_bill.expiring", payload)
    try:
        from app.core.push import send_eway_bill_alert_push
        from app.modules.core.devices.models import DeviceToken
        from app.modules.identity.organisations.membership_models import MemberStatus, OrganisationMember

        tokens = (
            await ctx.db.execute(
                select(DeviceToken.token)
                .join(OrganisationMember, OrganisationMember.user_id == DeviceToken.user_id)
                .where(
                    OrganisationMember.organisation_id == ctx.organisation_id,
                    OrganisationMember.status == MemberStatus.ACTIVE,
                )
                .distinct()
            )
        ).scalars().all()
        for tok in tokens:
            await send_eway_bill_alert_push(
                token=tok,
                booking_number=booking.booking_number,
                eway_bill_number=booking.eway_bill_number or "",
                hours_left=hours_left,
            )
    except Exception:
        pass


async def update_eway_bill(
    ctx: OrgContext,
    booking_id: uuid.UUID,
    eway_bill_number: str,
    valid_until: datetime.datetime,
) -> BookingResponse:
    booking = await _get(ctx, booking_id)
    cleaned = _validate_eway_bill_format(eway_bill_number)
    booking.eway_bill_number = cleaned
    booking.eway_bill_valid_until = valid_until
    record_audit(
        ctx.db, ctx.organisation_id, ctx.user_id,
        "BOOKING_EWAY_BILL_UPDATED", "booking", booking.id,
        {"eway_bill_number": cleaned, "valid_until": valid_until.isoformat()},
    )
    await ctx.db.commit()
    await ctx.db.refresh(booking)

    now = datetime.datetime.now(datetime.timezone.utc)
    vu = valid_until if valid_until.tzinfo else valid_until.replace(tzinfo=datetime.timezone.utc)
    hours_left = (vu - now).total_seconds() / 3600.0
    if hours_left < 8.0:
        await _notify_eway_bill_alert(ctx, booking, hours_left)

    return BookingResponse.model_validate(booking)


async def check_expiring_eway_bills(ctx: OrgContext, warn_hours: int = 24) -> dict:
    now = datetime.datetime.now(datetime.timezone.utc)
    cutoff = now + datetime.timedelta(hours=warn_hours)
    stmt = select(Booking).where(
        Booking.organisation_id == ctx.organisation_id,
        Booking.eway_bill_number.isnot(None),
        Booking.eway_bill_valid_until.isnot(None),
        Booking.eway_bill_valid_until <= cutoff,
        Booking.status.notin_([BookingStatus.COMPLETED, BookingStatus.CANCELLED]),
    )
    rows = (await ctx.db.execute(stmt)).scalars().all()
    expiring_soon = 0
    expired = 0
    alerts: list[dict] = []
    for b in rows:
        vu = b.eway_bill_valid_until
        if vu is None:
            continue
        if vu.tzinfo is None:
            vu = vu.replace(tzinfo=datetime.timezone.utc)
        hours_left = (vu - now).total_seconds() / 3600.0
        if hours_left <= 0:
            expired += 1
        else:
            expiring_soon += 1
        alerts.append({
            "booking_id": str(b.id),
            "booking_number": b.booking_number,
            "eway_bill_number": b.eway_bill_number,
            "hours_left": round(hours_left, 1),
        })
        await _notify_eway_bill_alert(ctx, b, hours_left)

    return {
        "checked_count": len(rows),
        "expiring_soon_count": expiring_soon,
        "expired_count": expired,
        "alerts": alerts,
    }
