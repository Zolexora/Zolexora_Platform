from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AdminUserItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    phone_number: str | None = None
    full_name: str
    name: str | None = None
    coin_balance: int = 0
    status: Literal["active", "suspended", "banned", "pending_verification"]
    is_active: bool
    is_email_verified: bool
    is_phone_verified: bool
    created_at: datetime
    last_login_at: datetime | None = None


class AdminUserPage(BaseModel):
    items: list[AdminUserItem]
    total: int
    limit: int
    offset: int


class UserStatusPatch(BaseModel):
    status: Literal["active", "suspended", "banned", "pending_verification"]
    reason: str | None = Field(default=None, max_length=1000)


class AdminSummary(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    permissions: list[str]
    is_active: bool


class AuditLogItem(BaseModel):
    id: str
    action_type: str
    admin_id: str | None
    admin_email: str | None = None
    target_user_id: str | None
    details: dict
    ip_address: str | None
    request_id: str | None
    created_at: datetime
