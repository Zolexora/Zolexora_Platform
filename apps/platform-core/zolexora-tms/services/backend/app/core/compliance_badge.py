"""Compliance badge helper shared by mobile API responses.

Returns a colour-coded status for a given expiry date string (ISO date):
  EXPIRED      → 'danger'   (past today)
  EXPIRING_7D  → 'danger'   (≤ 7 days)
  EXPIRING_30D → 'warning'  (≤ 30 days)
  VALID        → 'success'

Used by the mobile-bootstrap endpoint so the app doesn't need to do date maths.
"""
from __future__ import annotations
import datetime
from typing import Optional


def expiry_badge(expiry_date: Optional[str | datetime.date | datetime.datetime]) -> dict:
    """Return { status, label, color } for an expiry date."""
    if expiry_date is None:
        return {"status": "MISSING", "label": "Not Set", "color": "muted"}

    today = datetime.date.today()

    if isinstance(expiry_date, datetime.datetime):
        exp = expiry_date.date()
    elif isinstance(expiry_date, str):
        try:
            exp = datetime.date.fromisoformat(expiry_date[:10])
        except ValueError:
            return {"status": "MISSING", "label": "Invalid", "color": "muted"}
    else:
        exp = expiry_date

    days_left = (exp - today).days

    if days_left < 0:
        return {"status": "EXPIRED", "label": f"Expired {abs(days_left)}d ago", "color": "danger"}
    elif days_left <= 7:
        return {"status": "EXPIRING_SOON", "label": f"Expires in {days_left}d", "color": "danger"}
    elif days_left <= 30:
        return {"status": "EXPIRING_SOON", "label": f"Expires in {days_left}d", "color": "warning"}
    else:
        return {"status": "VALID", "label": f"Valid ({days_left}d left)", "color": "success"}
