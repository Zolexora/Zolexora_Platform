import uuid
from typing import Optional
from fastapi import APIRouter, Body, Depends, Query, status

from app.auth.dependencies import OrgContext, get_org_context
from app.modules.operations.bookings.schemas import (
    BookingCreate,
    BookingResponse,
    BookingStatus,
    EwayBillCheckResponse,
    EwayBillUpdateRequest,
)
from app.modules.operations.bookings import service

router = APIRouter(prefix="/api/v1/bookings", tags=["Bookings"])


@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_booking(
    req: BookingCreate,
    ctx: OrgContext = Depends(get_org_context),
):
    return await service.create_booking(ctx, req)


@router.get("", response_model=list[BookingResponse])
async def list_bookings(
    status: Optional[BookingStatus] = None,
    customer_id: Optional[uuid.UUID] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    ctx: OrgContext = Depends(get_org_context),
):
    return await service.list_bookings(ctx, status, customer_id, skip, limit)


@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking(
    booking_id: uuid.UUID,
    ctx: OrgContext = Depends(get_org_context),
):
    return await service.get_booking(ctx, booking_id)


@router.post("/eway-bill/check-expiring", response_model=EwayBillCheckResponse)
async def check_expiring_eway_bills(
    warn_hours: int = Query(24, ge=1, le=72),
    ctx: OrgContext = Depends(get_org_context),
):
    return await service.check_expiring_eway_bills(ctx, warn_hours=warn_hours)


@router.post("/{booking_id}/eway-bill", response_model=BookingResponse)
async def update_eway_bill(
    booking_id: uuid.UUID,
    req: EwayBillUpdateRequest,
    ctx: OrgContext = Depends(get_org_context),
):
    return await service.update_eway_bill(ctx, booking_id, req.eway_bill_number, req.eway_bill_valid_until)


@router.post("/{booking_id}/cancel", response_model=BookingResponse)
async def cancel_booking(
    booking_id: uuid.UUID,
    reason: Optional[str] = Body(None, embed=True),
    ctx: OrgContext = Depends(get_org_context),
):
    return await service.cancel_booking(ctx, booking_id, reason)


@router.post("/{booking_id}/create-duty", status_code=status.HTTP_201_CREATED)
async def create_duty_from_booking(
    booking_id: uuid.UUID,
    req: dict = Body(...),
    ctx: OrgContext = Depends(get_org_context),
):
    from app.modules.operations.duties.schemas import DutyCreate, DutyResponse
    from app.modules.operations.duties import service as duty_service

    duty_create = DutyCreate(
        booking_id=booking_id,
        scheduled_start_time=req["scheduled_start_time"],
        scheduled_end_time=req["scheduled_end_time"],
        driver_id=req.get("driver_id"),
        vehicle_id=req.get("vehicle_id"),
        notes=req.get("notes"),
    )
    res = await duty_service.create_duty(ctx, duty_create)
    return DutyResponse.model_validate(res)

