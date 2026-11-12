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
