"""Passenger boarding PIN & live tracking notification dispatcher.

Builds per-passenger boarding alerts (4-digit PIN, cab registration, driver details,
and public /t/:token live tracking link), broadcasts a real-time WebSocket event to ops,
records an AuditLog entry, and optionally forwards to configured Resend email or
SMS/WhatsApp webhook adapters without blocking core trip state transitions.
"""
from __future__ import annotations

import logging
import os
import re
import uuid
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import record_audit
from app.core.config import settings
from app.core.websocket import ws_manager
from app.modules.fleet.drivers.models import Driver
from app.modules.fleet.vehicles.models import Vehicle
from app.modules.operations.bookings.enums import BookingServiceType
from app.modules.operations.bookings.models import Booking
from app.modules.operations.duties.models import Duty
from app.modules.operations.trips.models import Trip

logger = logging.getLogger("zolexora.passenger_notify")


def _clean_phone_digits(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 10:
        digits = f"91{digits}"
    return digits if len(digits) >= 10 else None


def _compose_message(
    *,
    stage: str,
    duty_number: str,
    vehicle_reg: Optional[str],
    driver_name: Optional[str],
    driver_phone: Optional[str],
    boarding_pin: Optional[str],
    tracking_url: Optional[str],
    recipient_name: Optional[str],
) -> str:
    greeting = f"Hi {recipient_name}, " if recipient_name else ""
    stage_label = {
        "DISPATCHED": "your cab is dispatched",
        "ARRIVED_PICKUP": "your cab has arrived at pickup",
        "IN_TRANSIT": "your trip has started",
    }.get(stage, f"trip update ({stage})")
    parts = [f"{greeting}{stage_label} ({duty_number})."]
    if vehicle_reg or driver_name:
        cab = vehicle_reg or "Cab assigned"
        drv = f"{driver_name}{f' ({driver_phone})' if driver_phone else ''}" if driver_name else "Driver assigned"
        parts.append(f"Cab: {cab} | Driver: {drv}.")
    if boarding_pin:
        parts.append(f"Boarding PIN: {boarding_pin}.")
    if tracking_url:
        parts.append(f"Track live: {tracking_url}")
    return " ".join(parts)


async def _dispatch_external(
    *,
    payload: Dict[str, Any],
    recipients: List[Dict[str, Any]],
    duty_number: str,
) -> None:
    webhook_url = settings.PASSENGER_NOTIFY_WEBHOOK_URL or os.getenv("PASSENGER_NOTIFY_WEBHOOK_URL")
    if webhook_url:
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                resp = await client.post(webhook_url, json=payload)
                if resp.status_code >= 400:
                    logger.warning("Passenger notify webhook HTTP %s", resp.status_code)
        except Exception as exc:
            logger.warning("Passenger notify webhook error: %s", exc)

    if settings.RESEND_API_KEY:
        from_addr = settings.RESEND_FROM_EMAIL or os.getenv("RESEND_FROM_EMAIL") or "Zolexora TMS <onboarding@resend.dev>"
        for r in recipients:
            email = r.get("email")
            if not email:
                continue
            try:
                async with httpx.AsyncClient(timeout=8) as client:
                    await client.post(
                        "https://api.resend.com/emails",
                        headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                        json={
                            "from": from_addr,
                            "to": [email],
                            "subject": f"Cab Update {duty_number} — Boarding PIN {r.get('boarding_pin') or ''}".strip(),
                            "text": r["message"],
                        },
                    )
            except Exception as exc:
                logger.warning("Resend passenger email error: %s", exc)


async def notify_passengers_for_duty(
    db: AsyncSession,
    duty: Duty,
    *,
    stage: str,
    trip: Optional[Trip] = None,
    actor_user_id: Optional[uuid.UUID] = None,
    public_origin: Optional[str] = None,
    commit_audit: bool = False,
) -> Dict[str, Any]:
    booking = (
        await db.execute(
            select(Booking).where(Booking.id == duty.booking_id, Booking.organisation_id == duty.organisation_id)
        )
    ).scalars().first()
    if not booking:
        return {"skipped": True, "recipients": []}

    s_val = booking.service_type.value if hasattr(booking.service_type, "value") else str(booking.service_type)
    if s_val != BookingServiceType.PASSENGER.value:
        return {"skipped": True, "recipients": []}

    if trip is None:
        trip = (await db.execute(select(Trip).where(Trip.duty_id == duty.id))).scalars().first()

    driver = (
        (await db.execute(select(Driver).where(Driver.id == duty.driver_id))).scalars().first()
        if duty.driver_id
        else None
    )
    vehicle = (
        (await db.execute(select(Vehicle).where(Vehicle.id == duty.vehicle_id))).scalars().first()
        if duty.vehicle_id
        else None
    )

    origin = (
        public_origin
        or settings.TMS_PUBLIC_WEB_URL
        or os.getenv("TMS_PUBLIC_WEB_URL")
        or os.getenv("NEXT_PUBLIC_TMS_CLIENT_PORTAL_URL")
        or "https://track.zolexora.com"
    ).rstrip("/")
    share_token = trip.share_token if trip and trip.share_token else None
    tracking_url = f"{origin}/t/{share_token}" if share_token else None

    recipients: List[Dict[str, Any]] = []
    stops = booking.stops if isinstance(booking.stops, list) else []
    for st in stops:
        if str(st.get("stop_type", "PICKUP")).upper() != "PICKUP":
            continue
        name = st.get("contact_name")
        phone = st.get("contact_phone")
        pin = st.get("boarding_pin") or booking.boarding_pin
        if name or phone:
            msg = _compose_message(
                stage=stage,
                duty_number=duty.duty_number,
                vehicle_reg=vehicle.registration_number if vehicle else None,
                driver_name=driver.full_name if driver else None,
                driver_phone=driver.phone if driver else None,
                boarding_pin=pin,
                tracking_url=tracking_url,
                recipient_name=name,
            )
            digits = _clean_phone_digits(phone)
            recipients.append({
                "seq": st.get("seq"),
                "name": name,
                "phone": phone,
                "email": None,
                "boarding_pin": pin,
                "message": msg,
                "wa_url": f"https://wa.me/{digits}?text={quote(msg)}" if digits else None,
            })

    pax = booking.passenger_info if isinstance(booking.passenger_info, dict) else {}
    primary_name = pax.get("name")
    primary_phone = pax.get("phone")
    primary_email = pax.get("email")
    if not recipients or (primary_phone and all(r.get("phone") != primary_phone for r in recipients)):
        msg = _compose_message(
            stage=stage,
            duty_number=duty.duty_number,
            vehicle_reg=vehicle.registration_number if vehicle else None,
            driver_name=driver.full_name if driver else None,
            driver_phone=driver.phone if driver else None,
            boarding_pin=booking.boarding_pin,
            tracking_url=tracking_url,
            recipient_name=primary_name,
        )
        digits = _clean_phone_digits(primary_phone)
        recipients.append({
            "seq": None,
            "name": primary_name,
            "phone": primary_phone,
            "email": primary_email,
            "boarding_pin": booking.boarding_pin,
            "message": msg,
            "wa_url": f"https://wa.me/{digits}?text={quote(msg)}" if digits else None,
        })

    summary_message = recipients[0]["message"] if recipients else _compose_message(
        stage=stage,
        duty_number=duty.duty_number,
        vehicle_reg=vehicle.registration_number if vehicle else None,
        driver_name=driver.full_name if driver else None,
        driver_phone=driver.phone if driver else None,
        boarding_pin=booking.boarding_pin,
        tracking_url=tracking_url,
        recipient_name=None,
    )

    result = {
        "duty_id": str(duty.id),
        "duty_number": duty.duty_number,
        "stage": stage,
        "share_token": share_token,
        "tracking_url": tracking_url,
        "boarding_pin": booking.boarding_pin,
        "message_text": summary_message,
        "recipients": recipients,
    }

    if actor_user_id:
        record_audit(
            db,
            duty.organisation_id,
            actor_user_id,
            "PASSENGER_ALERT_DISPATCHED",
            "duty",
            duty.id,
            {
                "stage": stage,
                "recipient_count": len(recipients),
                "has_tracking_link": bool(tracking_url),
            },
        )
        if commit_audit:
            await db.commit()

    await ws_manager.broadcast_to_org(
        duty.organisation_id,
        "duty.passenger_alert",
        {
            "duty_id": str(duty.id),
            "duty_number": duty.duty_number,
            "stage": stage,
            "recipient_count": len(recipients),
            "tracking_url": tracking_url,
        },
    )
    await _dispatch_external(payload=result, recipients=recipients, duty_number=duty.duty_number)
    return result
