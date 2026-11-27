"""Share-link endpoints for Zolexora TMS trips.

POST /api/v1/trips/{trip_id}/share-link
  — Generates a signed share token (valid 72h or until trip completes +24h)
  — Returns { share_url } pointing to public GET endpoint

GET /api/v1/tracking/public/{token}
  — No auth required
  — Returns trip status, latest GPS ping, and ETA (read-only)
"""
from __future__ import annotations

import datetime
import secrets
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.auth.dependencies import get_current_active_organisation, CurrentUserContext
from app.db.session import get_db
from app.modules.operations.trips.models import Trip, TripStatus

share_router = APIRouter(tags=["Tracking"])
public_router = APIRouter(tags=["Public Tracking"])


class ShareLinkResponse(BaseModel):
    share_token: str
    share_url: str
    expires_at: datetime.datetime


class PublicTrackingResponse(BaseModel):
    trip_number: str
    status: str
    pickup_address: Optional[str] = None
    drop_address: Optional[str] = None
    latest_latitude: Optional[float] = None
    latest_longitude: Optional[float] = None
    latest_location_at: Optional[datetime.datetime] = None
    expires_at: datetime.datetime


@share_router.post(
    "/api/v1/trips/{trip_id}/share-link",
    response_model=ShareLinkResponse,
    summary="Generate a shareable public tracking link for a trip",
)
async def create_share_link(
    trip_id: uuid.UUID,
    ctx: CurrentUserContext = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db),
) -> ShareLinkResponse:
    stmt = select(Trip).where(Trip.id == trip_id, Trip.organisation_id == ctx.organisation_id)
    res = await db.execute(stmt)
    trip = res.scalars().first()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

    # Re-use existing token if still valid
    now = datetime.datetime.now(datetime.timezone.utc)
    if trip.share_token and trip.share_token_expires_at and trip.share_token_expires_at > now:
        return _build_response(trip)

    # Generate new token: 72h from now (or 24h after completion)
    token = secrets.token_urlsafe(32)
    expires_at = now + datetime.timedelta(hours=72)

    trip.share_token = token
    trip.share_token_expires_at = expires_at
    await db.commit()
    await db.refresh(trip)

    return _build_response(trip)


def _build_response(trip: Trip) -> ShareLinkResponse:
    return ShareLinkResponse(
        share_token=trip.share_token,  # type: ignore[arg-type]
        share_url=f"https://track.zolexora.com/t/{trip.share_token}",
        expires_at=trip.share_token_expires_at,  # type: ignore[arg-type]
    )


@public_router.get(
    "/api/v1/tracking/public/{token}",
    response_model=PublicTrackingResponse,
    summary="Public live tracking — no authentication required",
)
async def public_tracking(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> PublicTrackingResponse:
    stmt = select(Trip).where(Trip.share_token == token)
    res = await db.execute(stmt)
    trip = res.scalars().first()

    now = datetime.datetime.now(datetime.timezone.utc)
    if not trip or not trip.share_token_expires_at or trip.share_token_expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tracking link not found or expired",
        )

    # Pull latest GPS event from trip_events (most recent location_update)
    from app.modules.operations.trips.models import TripEvent  # local import avoids circular
    evt_stmt = (
        select(TripEvent)
        .where(TripEvent.trip_id == trip.id, TripEvent.event_type == "location_update")
        .order_by(TripEvent.timestamp.desc())
        .limit(1)
    )
    evt_res = await db.execute(evt_stmt)
    latest_evt = evt_res.scalars().first()

    # Pull address from booking via duty relationship
    from app.modules.operations.duties.models import Duty  # local import
    from app.modules.operations.bookings.models import Booking  # local import
    duty_stmt = select(Duty).where(Duty.id == trip.duty_id)
    duty_res = await db.execute(duty_stmt)
    duty = duty_res.scalars().first()
    booking: Optional[Booking] = None
    if duty and duty.booking_id:
        bk_stmt = select(Booking).where(Booking.id == duty.booking_id)
        bk_res = await db.execute(bk_stmt)
        booking = bk_res.scalars().first()

    return PublicTrackingResponse(
        trip_number=trip.trip_number,
        status=trip.status.value if hasattr(trip.status, 'value') else str(trip.status),
        pickup_address=booking.pickup_address if booking else None,
        drop_address=booking.drop_address if booking else None,
        latest_latitude=latest_evt.latitude if latest_evt else None,
        latest_longitude=latest_evt.longitude if latest_evt else None,
        latest_location_at=latest_evt.timestamp if latest_evt else None,
        expires_at=trip.share_token_expires_at,
    )
