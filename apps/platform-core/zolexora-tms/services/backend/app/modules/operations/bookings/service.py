import datetime
import uuid
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import select

from app.auth.dependencies import OrgContext
from app.core.audit import record_audit
from app.core.geocoding import geocoding_service
from app.core.websocket import ws_manager
from app.modules.crm.clients.models import Client
from app.modules.operations.bookings.models import Booking
from app.modules.operations.bookings.schemas import BookingCreate, BookingResponse, BookingStatus


def new_booking_number() -> str:
    return f"BK-{datetime.datetime.now().year}-{uuid.uuid4().hex[:8].upper()}"


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
