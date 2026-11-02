"""Email router across the email connections added in the panel (Resend -> Brevo -> SendGrid).

Each connection has its own daily limit and in-memory daily count (reset at UTC midnight,
lost on restart). A connection at >= 90% of its limit, DRAINING, or failing is skipped.
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

from .. import clients
from ..connections import Connection, list_connections
from ..schemas.email import (
    EmailLogRecord,
    EmailLogsResponse,
    EmailQuotasResponse,
    EmailSendRequest,
    EmailSendResponse,
    ProviderQuotaMetric,
)

PROVIDER_ORDER = ["resend", "brevo", "sendgrid"]
DEFAULT_DAILY_LIMITS = {"resend": 100, "brevo": 300, "sendgrid": 100}  # free tiers
THROTTLE_PCT = 90.0
FALLBACK_LOG_LIMIT = 500

_daily_usage: Dict[str, int] = {}  # connection id -> sends today
_usage_day = datetime.now(timezone.utc).date()
_fallback_logs: List[EmailLogRecord] = []


def _roll_day() -> None:
    global _usage_day
    today = datetime.now(timezone.utc).date()
    if today != _usage_day:
        _usage_day = today
        _daily_usage.clear()


def get_daily_usage(conn_id: str) -> int:
    _roll_day()
    return _daily_usage.get(conn_id, 0)


def set_daily_usage(conn_id: str, count: int) -> None:
    _daily_usage[conn_id] = count


def reset_daily_usage() -> None:
    _daily_usage.clear()


def daily_limit(conn: Connection) -> int:
    value = conn.config.get("daily_limit", "")
    return int(value) if value.isdigit() and int(value) > 0 else DEFAULT_DAILY_LIMITS[conn.provider]


def usage_pct(conn: Connection) -> float:
    return round(get_daily_usage(conn.id) / daily_limit(conn) * 100, 2)


async def email_connections() -> List[Connection]:
    conns = await list_connections(category="email")
    return sorted(conns, key=lambda c: PROVIDER_ORDER.index(c.provider))  # stable: name order kept


async def get_provider_quotas() -> EmailQuotasResponse:
    metrics = []
    for conn in await email_connections():
        limit, used = daily_limit(conn), get_daily_usage(conn.id)
        metrics.append(ProviderQuotaMetric(
            provider=conn.provider, account_id=conn.id, name=conn.name, daily_limit=limit, daily_used=used,
            remaining_today=max(0, limit - used), usage_percentage=usage_pct(conn),
            is_throttled=usage_pct(conn) >= THROTTLE_PCT,
        ))
    return EmailQuotasResponse(providers=metrics, timestamp=datetime.now(timezone.utc).isoformat())


async def _log_collection():
    for conn in await list_connections(provider="mongodb"):
        if not conn.error and conn.status == "ACTIVE" and conn.config.get("email_log_collection"):
            return clients.mongo_db(conn)[conn.config["email_log_collection"]]
    return None


async def archive_log_record(record: EmailLogRecord) -> None:
    """Writes to the MongoDB email-log connection if one is set; always keeps a recent in-memory copy."""
    _fallback_logs.insert(0, record)
    del _fallback_logs[FALLBACK_LOG_LIMIT:]
    try:
        if (collection := await _log_collection()) is not None:
            await collection.insert_one(record.model_dump())
    except Exception:
        pass


async def _dispatch(conn: Connection, request: EmailSendRequest) -> Optional[str]:
    """Sends through one connection. Returns the provider message id, or None on failure."""
    key = conn.config["api_key"]
    sender = request.sender_email or conn.config.get("sender_email") or "noreply@zolexora.com"
    body = request.html_content or request.text_content or ""
    fallback_id = f"msg_{conn.provider}_{uuid.uuid4().hex[:12]}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        if conn.provider == "resend":
            resp = await client.post("https://api.resend.com/emails", headers={"Authorization": f"Bearer {key}"},
                                     json={"from": sender, "to": request.to, "subject": request.subject, "html": body})
            return resp.json().get("id", fallback_id) if resp.status_code in (200, 201) else None
        if conn.provider == "brevo":
            resp = await client.post("https://api.brevo.com/v3/smtp/email", headers={"api-key": key}, json={
                "sender": {"name": request.sender_name, "email": sender},
                "to": [{"email": a} for a in request.to], "subject": request.subject, "htmlContent": body})
            return resp.json().get("messageId", fallback_id) if resp.status_code in (200, 201) else None
        resp = await client.post("https://api.sendgrid.com/v3/mail/send", headers={"Authorization": f"Bearer {key}"}, json={
            "personalizations": [{"to": [{"email": a} for a in request.to]}], "from": {"email": sender},
            "subject": request.subject, "content": [{"type": "text/html", "value": body}]})
        return fallback_id if resp.status_code in (200, 202) else None


async def send_email(request: EmailSendRequest) -> EmailSendResponse:
    _roll_day()
    now = datetime.now(timezone.utc).isoformat()
    attempts = 0
    for conn in await email_connections():
        if conn.error or conn.status != "ACTIVE" or usage_pct(conn) >= THROTTLE_PCT:
            continue
        attempts += 1
        try:
            message_id = await _dispatch(conn, request)
        except Exception:
            message_id = None
        if message_id is None:
            continue
        _daily_usage[conn.id] = get_daily_usage(conn.id) + 1
        await archive_log_record(EmailLogRecord(
            id=str(uuid.uuid4()), message_id=message_id, provider=conn.provider, account=conn.id,
            product=request.product, recipient=request.to[0], subject=request.subject, status="sent", sent_at=now))
        return EmailSendResponse(success=True, message_id=message_id, provider_used=conn.provider,
                                 account_used=conn.id, status="sent", attempt_count=attempts, timestamp=now)

    failed_id = f"failed_{uuid.uuid4().hex[:8]}"
    await archive_log_record(EmailLogRecord(
        id=str(uuid.uuid4()), message_id=failed_id, provider="none", account="none", product=request.product,
        recipient=request.to[0], subject=request.subject, status="failed", sent_at=now,
        bounce_reason="No email connection delivered: none added, all draining or over 90% of their daily limit, or all failed."))
    return EmailSendResponse(success=False, message_id=failed_id, provider_used=None, account_used="none",
                             status="failed", attempt_count=attempts, timestamp=now)


async def query_email_logs(product: Optional[str] = None, provider: Optional[str] = None,
                           status: Optional[str] = None, page: int = 1, limit: int = 50) -> EmailLogsResponse:
    query: Dict[str, Any] = {k: v for k, v in (("product", product), ("provider", provider), ("status", status)) if v}
    try:
        if (collection := await _log_collection()) is not None:
            cursor = collection.find(query).sort("sent_at", -1).skip((page - 1) * limit).limit(limit)
            records = []
            async for doc in cursor:
                doc.pop("_id", None)
                records.append(EmailLogRecord(**doc))
            return EmailLogsResponse(logs=records, total=await collection.count_documents(query), page=page, limit=limit)
    except Exception:
        pass
    filtered = [r for r in _fallback_logs if all(getattr(r, k) == v for k, v in query.items())]
    start = (page - 1) * limit
    return EmailLogsResponse(logs=filtered[start:start + limit], total=len(filtered), page=page, limit=limit)
