from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any

class EmailSendRequest(BaseModel):
    product: str
    to: List[str] = Field(min_length=1)
    subject: str
    html_content: Optional[str] = None
    text_content: Optional[str] = None
    sender_name: Optional[str] = "Zolexora Platform"
    sender_email: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class EmailSendResponse(BaseModel):
    success: bool
    message_id: str
    provider_used: Optional[Literal["resend", "brevo", "sendgrid"]] = None
    account_used: str
    status: Literal["queued", "sent", "failed"]
    attempt_count: int
    timestamp: str

class ProviderQuotaMetric(BaseModel):
    provider: Literal["resend", "brevo", "sendgrid"]
    account_id: str
    daily_limit: int
    daily_used: int
    remaining_today: int
    usage_percentage: float
    is_throttled: bool

class EmailQuotasResponse(BaseModel):
    providers: List[ProviderQuotaMetric]
    timestamp: str

class EmailLogRecord(BaseModel):
    id: str
    message_id: str
    provider: str
    account: str
    product: str
    recipient: str
    subject: str
    status: Literal["queued", "sent", "delivered", "bounced", "failed"]
    sent_at: str
    bounce_reason: Optional[str] = None
    opened: bool = False

class EmailLogsResponse(BaseModel):
    logs: List[EmailLogRecord]
    total: int
    page: int
    limit: int
