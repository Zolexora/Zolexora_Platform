import os
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any
import httpx
from ..schemas.email import (
    EmailSendRequest,
    EmailSendResponse,
    ProviderQuotaMetric,
    EmailQuotasResponse,
    EmailLogRecord,
    EmailLogsResponse,
)

# ============================================================================
# ZOLEXORA PLATFORM — MULTI-PROVIDER EMAIL ROUTER & LOG COLLECTOR
# Intelligent routing across Resend (100/d), Brevo (300/d), SendGrid (100/d)
# Dynamic failover at 90% quota capacity, and permanent MongoDB log archiving.
# ============================================================================

DAILY_LIMITS = {
    "resend": 100,
    "brevo": 300,
    "sendgrid": 100,
}

# In-memory daily usage, reset when the UTC date changes. Lost on restart.
_daily_usage: Dict[str, int] = {p: 0 for p in DAILY_LIMITS}
_usage_day = datetime.now(timezone.utc).date()

# In-memory log of recent sends, used when MongoDB is unconfigured or offline.
_fallback_logs: List[EmailLogRecord] = []
FALLBACK_LOG_LIMIT = 500

def _roll_day() -> None:
    global _usage_day
    today = datetime.now(timezone.utc).date()
    if today != _usage_day:
        _usage_day = today
        reset_daily_usage()

def get_daily_usage(provider: str) -> int:
    """Returns current daily usage for a provider."""
    _roll_day()
    return _daily_usage.get(provider, 0)

def set_daily_usage(provider: str, count: int) -> None:
    """Sets daily usage for a provider (useful for testing failover scenarios)."""
    _daily_usage[provider] = count

def reset_daily_usage() -> None:
    """Resets daily usage counters."""
    for p in DAILY_LIMITS:
        _daily_usage[p] = 0

def get_provider_quotas() -> EmailQuotasResponse:
    """
    Returns current quota metrics for all configured email providers.
    Calculates 90% threshold throttling.
    """
    _roll_day()
    metrics: List[ProviderQuotaMetric] = []
    for provider, limit in DAILY_LIMITS.items():
        used = _daily_usage.get(provider, 0)
        pct = round((used / limit) * 100, 2)
        throttled = pct >= 90.0
        remaining = max(0, limit - used)

        metrics.append(
            ProviderQuotaMetric(
                provider=provider,  # type: ignore
                account_id=f"{provider}-acc-01",
                daily_limit=limit,
                daily_used=used,
                remaining_today=remaining,
                usage_percentage=pct,
                is_throttled=throttled
            )
        )

    return EmailQuotasResponse(
        providers=metrics,
        timestamp=datetime.now(timezone.utc).isoformat()
    )

async def archive_log_record(log_record: EmailLogRecord) -> None:
    """
    Asynchronously archives an email delivery log record into MongoDB Atlas 'email_logs'.
    Falls back safely to in-memory audit log without failing if MongoDB is unconfigured.
    """
    _fallback_logs.insert(0, log_record)
    del _fallback_logs[FALLBACK_LOG_LIMIT:]

    try:
        from ..db.connections import get_mongo
        db = await get_mongo("zolexora-engage", raise_on_missing=False)
        if db is not None:
            collection = db["email_logs"]
            await collection.insert_one(log_record.model_dump())
    except Exception:
        # Non-blocking graceful degradation: log stored in _fallback_logs
        pass

async def send_email(request: EmailSendRequest) -> EmailSendResponse:
    """
    Dispatches a transactional email through the intelligent multi-provider router.
    Evaluates provider quotas in priority order: Resend -> Brevo -> SendGrid.
    Fails over when provider reaches >= 90% daily limit, has no API key, or returns an error.
    """
    _roll_day()
    provider_priority = ["resend", "brevo", "sendgrid"]
    attempts = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    for provider in provider_priority:
        attempts += 1
        limit = DAILY_LIMITS[provider]
        used = _daily_usage.get(provider, 0)
        usage_pct = (used / limit) * 100.0

        # Skip provider if daily quota reached 90% threshold
        if usage_pct >= 90.0:
            continue

        api_key = os.getenv(f"{provider.upper()}_API_KEY")
        if not api_key:
            continue

        success = False
        message_id = f"msg_{provider}_{uuid.uuid4().hex[:12]}"
        body = request.html_content or request.text_content or ""

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                if provider == "resend":
                    resp = await client.post(
                        "https://api.resend.com/emails",
                        headers={"Authorization": f"Bearer {api_key}"},
                        json={
                            "from": request.sender_email or "onboarding@resend.dev",
                            "to": request.to,
                            "subject": request.subject,
                            "html": body,
                        }
                    )
                    if resp.status_code in (200, 201):
                        message_id = resp.json().get("id", message_id)
                        success = True
                elif provider == "brevo":
                    resp = await client.post(
                        "https://api.brevo.com/v3/smtp/email",
                        headers={"api-key": api_key},
                        json={
                            "sender": {"name": request.sender_name, "email": request.sender_email or "noreply@zolexora.com"},
                            "to": [{"email": addr} for addr in request.to],
                            "subject": request.subject,
                            "htmlContent": body,
                        }
                    )
                    if resp.status_code in (200, 201):
                        message_id = resp.json().get("messageId", message_id)
                        success = True
                elif provider == "sendgrid":
                    resp = await client.post(
                        "https://api.sendgrid.com/v3/mail/send",
                        headers={"Authorization": f"Bearer {api_key}"},
                        json={
                            "personalizations": [{"to": [{"email": addr} for addr in request.to]}],
                            "from": {"email": request.sender_email or "noreply@zolexora.com"},
                            "subject": request.subject,
                            "content": [{"type": "text/html", "value": body}]
                        }
                    )
                    if resp.status_code in (200, 202):
                        success = True

        except Exception:
            # On network or API error, fail over to next provider
            success = False

        if success:
            _daily_usage[provider] = used + 1
            log_record = EmailLogRecord(
                id=str(uuid.uuid4()),
                message_id=message_id,
                provider=provider,
                account=f"{provider}-acc-01",
                product=request.product,
                recipient=request.to[0] if request.to else "unknown@zolexora.com",
                subject=request.subject,
                status="sent",
                sent_at=now_iso,
                opened=False,
                bounce_reason=None
            )
            await archive_log_record(log_record)

            return EmailSendResponse(
                success=True,
                message_id=message_id,
                provider_used=provider,  # type: ignore
                account_used=f"{provider}-acc-01",
                status="sent",
                attempt_count=attempts,
                timestamp=now_iso
            )

    # If all providers were throttled or failed
    failed_id = f"failed_{uuid.uuid4().hex[:8]}"
    failed_record = EmailLogRecord(
        id=str(uuid.uuid4()),
        message_id=failed_id,
        provider="none",
        account="none",
        product=request.product,
        recipient=request.to[0] if request.to else "unknown@zolexora.com",
        subject=request.subject,
        status="failed",
        sent_at=now_iso,
        opened=False,
        bounce_reason="No provider delivered: each was unconfigured, over 90% of its daily quota, or failed."
    )
    await archive_log_record(failed_record)

    return EmailSendResponse(
        success=False,
        message_id=failed_id,
        provider_used=None,
        account_used="none",
        status="failed",
        attempt_count=attempts,
        timestamp=now_iso
    )

async def query_email_logs(
    product: Optional[str] = None,
    provider: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 50
) -> EmailLogsResponse:
    """
    Queries archived email logs from MongoDB Atlas or fallback store.
    Supports filtering by product, provider, status, and pagination.
    """
    records: List[EmailLogRecord] = []

    try:
        from ..db.connections import get_mongo
        db = await get_mongo("zolexora-engage", raise_on_missing=False)
        if db is not None:
            collection = db["email_logs"]
            query: Dict[str, Any] = {}
            if product:
                query["product"] = product
            if provider:
                query["provider"] = provider
            if status:
                query["status"] = status

            cursor = collection.find(query).sort("sent_at", -1).skip((page - 1) * limit).limit(limit)
            async for doc in cursor:
                doc["id"] = str(doc.get("_id", doc.get("id", "")))
                records.append(EmailLogRecord(**doc))

            total_count = await collection.count_documents(query)
            if records:
                return EmailLogsResponse(logs=records, total=total_count, page=page, limit=limit)
    except Exception:
        pass

    # Fallback to in-memory store
    filtered = _fallback_logs
    if product:
        filtered = [item for item in filtered if item.product == product]
    if provider:
        filtered = [item for item in filtered if item.provider == provider]
    if status:
        filtered = [item for item in filtered if item.status == status]

    total = len(filtered)
    start_idx = (page - 1) * limit
    paged = filtered[start_idx:start_idx + limit]

    return EmailLogsResponse(logs=paged, total=total, page=page, limit=limit)
