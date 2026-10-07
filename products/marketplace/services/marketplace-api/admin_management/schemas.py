from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AdminUserItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    firebase_uid: str | None = None
    email: str
    phone_number: str | None = None
    full_name: str
    name: str | None = None
    coin_balance: int = 0
    status: Literal["active", "suspended", "banned", "pending_verification"]
    is_active: bool
    is_email_verified: bool
    is_phone_verified: bool
    providers: list[str] = Field(default_factory=list)
    role: str
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


class AdminPermissionPatch(BaseModel):
    permissions: list[str] = Field(default_factory=list, max_length=100)


class AdminRolePatch(BaseModel):
    role: Literal["super_admin", "support_admin", "moderator", "compliance_auditor"]


class AdminCreate(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    full_name: str = Field(min_length=1, max_length=150)
    role: Literal["super_admin", "support_admin", "moderator", "compliance_auditor"] = "support_admin"
    permissions: list[str] = Field(default_factory=list, max_length=100)


class AuditLogItem(BaseModel):
    id: str
    action_type: str
    admin_id: str | None
    target_user_id: str | None
    details: dict
    ip_address: str | None
    request_id: str | None
    created_at: datetime
