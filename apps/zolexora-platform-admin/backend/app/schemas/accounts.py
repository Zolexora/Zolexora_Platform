from pydantic import BaseModel
from typing import List, Optional, Literal

AccountStatus = Literal["ACTIVE", "DRAINING", "DISCONNECTED", "QUOTA_THROTTLED"]
ProviderType = Literal["firebase", "cloudflare", "supabase", "mongodb", "resend", "brevo", "sendgrid"]

class DiscoveredAccount(BaseModel):
    id: str
    provider: ProviderType
    alias: str
    project_id_or_account_id: str
    status: AccountStatus = "ACTIVE"
    monthly_quota_total: Optional[int] = None
    monthly_quota_used: Optional[int] = None
    daily_quota_total: Optional[int] = None
    daily_quota_used: Optional[int] = None
    quota_percentage: float = 0.0
    latency_ms: Optional[int] = None
    last_synced_at: str

class AccountDiagnosticAlert(BaseModel):
    event: str = "ROUTER_CREDENTIAL_MISSING"
    severity: Literal["INFO", "WARNING", "CRITICAL"] = "WARNING"
    provider: str
    target_product: str
    expected_secret: str
    infisical_path: str
    message: str
    timestamp: str

class AccountSyncResponse(BaseModel):
    status: Literal["success", "partial", "failed"]
    discovered_count: int
    active_count: int
    throttled_count: int
    disconnected_count: int
    diagnostics: List[str] = []
    timestamp: str

class AccountsListResponse(BaseModel):
    accounts: List[DiscoveredAccount]
    total_count: int
    active_count: int
    throttled_count: int
    alerts: List[AccountDiagnosticAlert] = []

class AccountStatusUpdateRequest(BaseModel):
    status: AccountStatus
