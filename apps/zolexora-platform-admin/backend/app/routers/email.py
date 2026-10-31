from typing import Optional
from fastapi import APIRouter, Query
from ..schemas.email import (
    EmailSendRequest,
    EmailSendResponse,
    EmailQuotasResponse,
    EmailLogsResponse,
)
from ..services.email import (
    send_email,
    get_provider_quotas,
    query_email_logs,
)

router = APIRouter(prefix="/api/email", tags=["Email"])

@router.post("/send", response_model=EmailSendResponse)
async def dispatch_email(request: EmailSendRequest) -> EmailSendResponse:
    """
    Unified transactional email sending gateway.
    Routes intelligently across Resend, Brevo, and SendGrid accounts with 90% quota failover.
    Archives delivery records into MongoDB 'email_logs'.
    """
    response = await send_email(request)
    if not response.success and response.status == "failed":
        # We still return the structured response body with status 503 if requested, or return 200 with success=False
        # Project spec indicates response contract: { success: bool, message_id: str, provider_used: ..., status: ... }
        return response
    return response

@router.get("/quotas", response_model=EmailQuotasResponse)
def get_quotas() -> EmailQuotasResponse:
    """
    Returns real-time daily quota metrics across Resend (100/d), Brevo (300/d), and SendGrid (100/d).
    """
    return get_provider_quotas()

@router.get("/logs", response_model=EmailLogsResponse)
async def get_logs(
    product: Optional[str] = Query(None, description="Filter by product name"),
    provider: Optional[str] = Query(None, description="Filter by provider"),
    status: Optional[str] = Query(None, description="Filter by delivery status"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page")
) -> EmailLogsResponse:
    """
    Retrieves permanently archived email logs from MongoDB Atlas.
    """
    return await query_email_logs(product=product, provider=provider, status=status, page=page, limit=limit)
