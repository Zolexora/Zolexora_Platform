"""Expo Push Notification sender.

Uses the Expo Push API (https://exp.host/--/api/v2/push/send).
No third-party SDK needed — httpx is already in the backend.
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx

logger = logging.getLogger("zolexora.push")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_expo_push(
    *,
    token: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
    sound: str = "default",
    badge: Optional[int] = None,
) -> None:
    """Fire-and-forget: sends one Expo push notification.

    Logs failures at WARNING level but never raises — a failed push should
    never abort the calling business operation.
    """
    if not token.startswith("ExponentPushToken["):
        logger.debug("Skipping non-Expo token: %s", token[:20])
        return

    payload: dict = {
        "to": token,
        "title": title,
        "body": body,
        "sound": sound,
        "data": data or {},
    }
    if badge is not None:
        payload["badge"] = badge

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(EXPO_PUSH_URL, json=payload)
            if resp.status_code != 200:
                logger.warning("Expo push HTTP %s: %s", resp.status_code, resp.text[:200])
                return
            result = resp.json()
            for item in result.get("data", []):
                if item.get("status") == "error":
                    logger.warning("Expo push error: %s — %s", item.get("message"), item.get("details"))
    except Exception as exc:
        logger.warning("Expo push exception: %s", exc)


async def send_duty_assigned_push(*, driver_token: str, duty_number: str, duty_id: str) -> None:
    await send_expo_push(
        token=driver_token,
        title="🚛 Duty Assigned",
        body=f"You've been assigned to {duty_number}. Tap to review.",
        data={"screen": "duty", "duty_id": duty_id},
    )


async def send_duty_dispatched_push(*, driver_token: str, duty_number: str, duty_id: str) -> None:
    await send_expo_push(
        token=driver_token,
        title="🚦 Duty Dispatched",
        body=f"{duty_number} has been dispatched. Time to move!",
        data={"screen": "duty", "duty_id": duty_id},
    )


async def send_trip_exception_push(
    *,
    token: str,
    trip_number: str,
    event_type: str,
    duty_id: str,
    notes: Optional[str] = None,
) -> None:
    is_sos = event_type == "SOS_EMERGENCY"
    label = event_type.replace("_", " ").title()
    await send_expo_push(
        token=token,
        title=f"🆘 EMERGENCY SOS — {trip_number}" if is_sos else f"⚠️ Trip Exception — {trip_number}",
        body=notes or f"Driver reported {label}. Tap to inspect duty.",
        data={"screen": "duty", "duty_id": duty_id, "event_type": event_type},
    )


async def send_eway_bill_alert_push(
    *,
    token: str,
    booking_number: str,
    eway_bill_number: str,
    hours_left: float,
) -> None:
    is_expired = hours_left <= 0
    await send_expo_push(
        token=token,
        title=f"🚨 e-Way Bill Expired — {booking_number}" if is_expired else f"⚠️ e-Way Bill Expiring — {booking_number}",
        body=(
            f"e-Way Bill {eway_bill_number} has expired. Extend immediately to avoid transit seizure."
            if is_expired
            else f"e-Way Bill {eway_bill_number} expires in {max(1, int(hours_left))}h."
        ),
        data={"screen": "duties", "booking_number": booking_number},
    )
