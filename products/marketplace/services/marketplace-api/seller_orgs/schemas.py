from datetime import datetime
from typing import Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class SellerOrgCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=2, max_length=200)
    slug: str = Field(..., min_length=2, max_length=100)
    metadata: dict[str, Any] | None = None


class SellerOrgUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(None, min_length=2, max_length=200)
    metadata: dict[str, Any] | None = None


class SellerOrgResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: UUID
    name: str
    slug: str
    status: str
    verification_status: str
    onboarding_state: str
    metadata: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime


class SellerOrgMemberInvite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: UUID
    role: str = Field("MEMBER", description="OWNER, ADMIN, MANAGER, MEMBER")
    permissions: list[str] | None = None


class SellerOrgMemberUpdateRole(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: str = Field(..., description="OWNER, ADMIN, MANAGER, MEMBER")
    permissions: list[str] | None = None


class SellerOrgMemberResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: UUID
    organization_id: UUID
    user_id: UUID
    role: str
    permissions: list[str] | None = None
    status: str
    joined_at: datetime
    created_at: datetime
    updated_at: datetime


class StorefrontGrantRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    storefront_id: UUID
    grant_reason: str | None = Field(None, max_length=500)


class StorefrontGrantDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: str = Field(..., description="APPROVE, REVOKE, or SUSPEND")
    reason: str | None = Field(None, max_length=500)


class StorefrontGrantResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: UUID
    organization_id: UUID
    storefront_id: UUID
    grant_status: str
    granted_by_user_id: UUID | None = None
    grant_reason: str | None = None
    effective_at: datetime | None = None
    revoked_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class AdminVerificationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    verification_status: str = Field(..., description="UNVERIFIED, PENDING, VERIFIED, REJECTED, NEEDS_REVISION")
    notes: str | None = None


class AdminSuspensionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: str = Field(..., description="SUSPEND or UNSUSPEND")
    reason: str = Field(..., min_length=1, max_length=500)


class SellerAuditLogResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: UUID
    organization_id: UUID
    actor_user_id: UUID
    action: str
    resource_type: str
    resource_id: UUID
    payload: dict[str, Any] | None = None
    created_at: datetime


class SellerVerificationHistoryResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: UUID
    organization_id: UUID
    verified_by_user_id: UUID
    status: str
    notes: str | None = None
    created_at: datetime
