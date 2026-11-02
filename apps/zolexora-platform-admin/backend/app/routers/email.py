from typing import Optional
from fastapi import APIRouter, Query
from ..schemas.email import EmailLogsResponse, EmailQuotasResponse, EmailSendRequest, EmailSendResponse
from ..services.email import get_provider_quotas, query_email_logs, send_email

router = APIRouter(prefix="/api/email", tags=["Email"])


@router.post("/send", response_model=EmailSendResponse)
async def dispatch_email(request: EmailSendRequest) -> EmailSendResponse:
    """Sends through the email connections in order, failing over at 90% of a daily limit or on error."""
    return await send_email(request)


@router.get("/quotas", response_model=EmailQuotasResponse)
async def get_quotas() -> EmailQuotasResponse:
    return await get_provider_quotas()


@router.get("/logs", response_model=EmailLogsResponse)
async def get_logs(
    product: Optional[str] = Query(None),
    provider: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
) -> EmailLogsResponse:
    return await query_email_logs(product=product, provider=provider, status=status, page=page, limit=limit)
