import datetime
import uuid
from typing import Optional
from fastapi import APIRouter, Body, Depends, Query, status

from app.auth.dependencies import OrgContext, get_org_context
from app.modules.operations.duties.schemas import (
    DutyAssignRequest,
    DutyCreate,
    DutyResponse,
    DutyStatus,
    DutyStopUpdateRequest,
    EscortVerifyRequest,
    PassengerNotifyRequest,
    PassengerNotifyResponse,
    SafeDropConfirmRequest,
    SlaSafetyReportResponse,
)
from app.modules.operations.duties import service

router = APIRouter(prefix="/api/v1/duties", tags=["Duties"])


@router.post("", response_model=DutyResponse, status_code=status.HTTP_201_CREATED)
async def create_duty(
    req: DutyCreate,
    ctx: OrgContext = Depends(get_org_context),
):
    return await service.create_duty(ctx, req)


@router.get("", response_model=list[DutyResponse])
async def list_duties(
    status: Optional[DutyStatus] = None,
    driver_id: Optional[uuid.UUID] = None,
    vehicle_id: Optional[uuid.UUID] = None,
    vendor_id: Optional[uuid.UUID] = None,
    search: Optional[str] = Query(None, max_length=120),
    date_from: Optional[datetime.datetime] = None,
    date_to: Optional[datetime.datetime] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    ctx: OrgContext = Depends(get_org_context),
):
    return await service.list_duties(
        ctx, status, driver_id, vehicle_id, vendor_id, skip, limit,
        search=search, date_from=date_from, date_to=date_to,
    )


@router.get("/reports/sla-safety", response_model=SlaSafetyReportResponse)
async def get_sla_safety_report(
    date_from: Optional[datetime.datetime] = None,
    date_to: Optional[datetime.datetime] = None,
    customer_id: Optional[uuid.UUID] = None,
    booking_type: Optional[str] = Query(None, max_length=32),
    limit: int = Query(200, ge=1, le=500),
    ctx: OrgContext = Depends(get_org_context),
):
    return await service.get_sla_safety_report(
        ctx,
        date_from=date_from,
        date_to=date_to,
        customer_id=customer_id,
        booking_type=booking_type,
        limit=limit,
    )


@router.get("/{duty_id}", response_model=DutyResponse)
async def get_duty(
    duty_id: uuid.UUID,
    ctx: OrgContext = Depends(get_org_context),
):
    return await service.get_duty(ctx, duty_id)


@router.post("/{duty_id}/assign", response_model=DutyResponse)
async def assign_duty(
    duty_id: uuid.UUID,
    req: DutyAssignRequest,
    ctx: OrgContext = Depends(get_org_context),
):
    return await service.assign_duty(ctx, duty_id, req)


@router.post("/{duty_id}/dispatch", response_model=DutyResponse)
async def dispatch_duty(
    duty_id: uuid.UUID,
    ctx: OrgContext = Depends(get_org_context),
):
    return await service.dispatch_duty(ctx, duty_id)


@router.post("/{duty_id}/accept", response_model=DutyResponse)
async def accept_duty(
    duty_id: uuid.UUID,
    ctx: OrgContext = Depends(get_org_context),
):
    return await service.driver_accept_duty(ctx, duty_id)


@router.post("/{duty_id}/reject", response_model=DutyResponse)
async def reject_duty(
    duty_id: uuid.UUID,
    reason: Optional[str] = Body(None, embed=True),
    ctx: OrgContext = Depends(get_org_context),
):
    return await service.driver_reject_duty(ctx, duty_id, reason)


@router.post("/{duty_id}/arrived-pickup", response_model=DutyResponse)
async def arrive_pickup(
    duty_id: uuid.UUID,
    ctx: OrgContext = Depends(get_org_context),
):
    return await service.update_duty_milestone(ctx, duty_id, DutyStatus.ARRIVED_PICKUP)


@router.post("/{duty_id}/in-transit", response_model=DutyResponse)
async def in_transit(
    duty_id: uuid.UUID,
    ctx: OrgContext = Depends(get_org_context),
):
    return await service.update_duty_milestone(ctx, duty_id, DutyStatus.IN_TRANSIT)


@router.post("/{duty_id}/arrived-drop", response_model=DutyResponse)
async def arrive_drop(
    duty_id: uuid.UUID,
    ctx: OrgContext = Depends(get_org_context),
):
    return await service.update_duty_milestone(ctx, duty_id, DutyStatus.ARRIVED_DROP)


@router.post("/{duty_id}/complete", response_model=DutyResponse)
async def complete_duty(
    duty_id: uuid.UUID,
    ctx: OrgContext = Depends(get_org_context),
):
    return await service.update_duty_milestone(ctx, duty_id, DutyStatus.DUTY_COMPLETED)


@router.post("/{duty_id}/stops/{seq}/update", response_model=DutyResponse)
async def update_duty_stop(
    duty_id: uuid.UUID,
    seq: int,
    req: DutyStopUpdateRequest,
    ctx: OrgContext = Depends(get_org_context),
):
    return await service.update_duty_stop(ctx, duty_id, seq, req)


@router.post("/{duty_id}/escort-check", response_model=DutyResponse)
async def verify_escort(
    duty_id: uuid.UUID,
    req: EscortVerifyRequest,
    ctx: OrgContext = Depends(get_org_context),
):
    return await service.verify_escort(ctx, duty_id, req)


@router.post("/{duty_id}/safe-drop", response_model=DutyResponse)
async def confirm_safe_drop(
    duty_id: uuid.UUID,
    req: SafeDropConfirmRequest = SafeDropConfirmRequest(),
    ctx: OrgContext = Depends(get_org_context),
):
    return await service.confirm_safe_drop(ctx, duty_id, req)


@router.post("/{duty_id}/notify-passengers", response_model=PassengerNotifyResponse)
async def notify_passengers(
    duty_id: uuid.UUID,
    req: PassengerNotifyRequest = PassengerNotifyRequest(),
    ctx: OrgContext = Depends(get_org_context),
):
    return await service.notify_passengers(ctx, duty_id, public_origin=req.public_origin)

