import datetime
import uuid
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import select

from app.auth.dependencies import OrgContext
from app.core.audit import record_audit
from app.core.websocket import ws_manager
from app.modules.operations.bookings.models import Booking, BookingRequest
from app.modules.operations.bookings.schemas_request import BookingRequestCreate, BookingRequestResponse
from app.modules.operations.bookings.enums import BookingRequestStatus, BookingStatus
from app.modules.operations.bookings.schemas import BookingResponse
from app.modules.operations.bookings.service import ensure_customer, new_booking_number


async def _get(ctx: OrgContext, request_id: uuid.UUID) -> BookingRequest:
    res = await ctx.db.execute(
        select(BookingRequest).where(BookingRequest.id == request_id, BookingRequest.organisation_id == ctx.organisation_id)
    )
    req = res.scalars().first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking request not found")
    return req


async def _set_status(ctx: OrgContext, req: BookingRequest, new_status: BookingRequestStatus, event: str) -> None:
    previous = req.status
    req.status = new_status
    record_audit(ctx.db, ctx.organisation_id, ctx.user_id, f"BOOKING_REQUEST_{event.upper()}", "booking_request", req.id,
                 {"request_number": req.request_number, "previous_status": previous.value})


async def create_booking_request(ctx: OrgContext, req: BookingRequestCreate) -> BookingRequestResponse:
    await ensure_customer(ctx, req.customer_id)
    booking_request = BookingRequest(
        **req.model_dump(),
        request_number=f"REQ-{datetime.datetime.now().year}-{uuid.uuid4().hex[:8].upper()}",
        organisation_id=ctx.organisation_id,
        status=BookingRequestStatus.DRAFT,
        created_by_user_id=ctx.user_id,
    )
    ctx.db.add(booking_request)
    await ctx.db.flush()
    record_audit(ctx.db, ctx.organisation_id, ctx.user_id, "BOOKING_REQUEST_CREATED", "booking_request",
                 booking_request.id, {"request_number": booking_request.request_number})
    await ctx.db.commit()

    await ws_manager.broadcast_to_org(ctx.organisation_id, "booking_request.created", {"request_id": str(booking_request.id)})
    return BookingRequestResponse.model_validate(booking_request)


async def list_booking_requests(
    ctx: OrgContext,
    status_filter: Optional[BookingRequestStatus] = None,
    customer_id: Optional[uuid.UUID] = None,
    skip: int = 0,
    limit: int = 50,
) -> list[BookingRequestResponse]:
    stmt = select(BookingRequest).where(BookingRequest.organisation_id == ctx.organisation_id)
    if status_filter:
        stmt = stmt.where(BookingRequest.status == status_filter)
    if customer_id:
        stmt = stmt.where(BookingRequest.customer_id == customer_id)
    stmt = stmt.order_by(BookingRequest.created_at.desc()).limit(limit).offset(skip)
    res = await ctx.db.execute(stmt)
    return [BookingRequestResponse.model_validate(r) for r in res.scalars().all()]


async def get_booking_request(ctx: OrgContext, request_id: uuid.UUID) -> BookingRequestResponse:
    return BookingRequestResponse.model_validate(await _get(ctx, request_id))


async def submit_booking_request(ctx: OrgContext, request_id: uuid.UUID) -> BookingRequestResponse:
    req = await _get(ctx, request_id)
    if req.status != BookingRequestStatus.DRAFT:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Can only submit DRAFT requests")
    await _set_status(ctx, req, BookingRequestStatus.REQUESTED, "submitted")
    await ctx.db.commit()
    await ws_manager.broadcast_to_org(ctx.organisation_id, "booking_request.submitted", {"request_id": str(request_id)})
    return BookingRequestResponse.model_validate(req)


async def confirm_booking_request(ctx: OrgContext, request_id: uuid.UUID) -> BookingResponse:
    req = await _get(ctx, request_id)
    if req.status not in (BookingRequestStatus.REQUESTED, BookingRequestStatus.DRAFT):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot confirm request from this status")
    await _set_status(ctx, req, BookingRequestStatus.CONFIRMED, "confirmed")

    booking = Booking(
        booking_number=new_booking_number(),
        organisation_id=ctx.organisation_id,
        booking_request_id=req.id,
        customer_id=req.customer_id,
        booking_type=req.booking_type,
        service_type=req.service_type,
        pickup_address=req.pickup_address,
        pickup_lat=req.pickup_lat,
        pickup_lng=req.pickup_lng,
        drop_address=req.drop_address,
        drop_lat=req.drop_lat,
        drop_lng=req.drop_lng,
        pickup_datetime=req.pickup_datetime,
        expected_completion_datetime=req.expected_completion_datetime,
        passenger_info=req.passenger_info,
        cargo_info=req.cargo_info,
        vehicle_requirements=req.vehicle_requirements,
        operational_instructions=req.special_instructions,
        rate_card_version_id=req.rate_card_version_id,
        source=req.source,
        status=BookingStatus.CONFIRMED,
        created_by_user_id=ctx.user_id,
    )
    ctx.db.add(booking)
    await ctx.db.flush()
    record_audit(ctx.db, ctx.organisation_id, ctx.user_id, "BOOKING_CREATED", "booking", booking.id,
                 {"booking_number": booking.booking_number, "booking_request_id": str(req.id)})
    await ctx.db.commit()

    await ws_manager.broadcast_to_org(ctx.organisation_id, "booking_request.confirmed", {"request_id": str(request_id)})
    return BookingResponse.model_validate(booking)


async def cancel_booking_request(ctx: OrgContext, request_id: uuid.UUID, reason: Optional[str]) -> BookingRequestResponse:
    req = await _get(ctx, request_id)
    if req.status in (BookingRequestStatus.CANCELLED, BookingRequestStatus.CONFIRMED):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot cancel from this status")
    await _set_status(ctx, req, BookingRequestStatus.CANCELLED, "cancelled")
    await ctx.db.commit()
    await ws_manager.broadcast_to_org(ctx.organisation_id, "booking_request.cancelled", {"request_id": str(request_id)})
    return BookingRequestResponse.model_validate(req)
