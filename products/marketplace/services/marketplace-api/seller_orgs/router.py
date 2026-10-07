import uuid
import re
from datetime import datetime, timezone
from typing import Any
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.deps import current_user, admin_only, is_development_mock_seller
from core.config import settings

from .schemas import (
    SellerOrgCreate,
    SellerOrgResponse,
    SellerOrgMemberInvite,
    SellerOrgMemberUpdateRole,
    SellerOrgMemberResponse,
    StorefrontGrantRequest,
    StorefrontGrantDecision,
    StorefrontGrantResponse,
    AdminVerificationUpdate,
    AdminSuspensionUpdate,
    SellerAuditLogResponse,
    SellerVerificationHistoryResponse,
)
from .repository import PostgresSellerRepository
from users.repositories import UserRepository, get_user_repository
from .dependencies import (
    get_seller_repo,
    require_active_seller_org,
    get_current_seller_org_member,
    require_seller_org_role,
)

router = APIRouter(tags=["seller-organizations"])

GSTIN_PATTERN = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")


@router.get("/seller/verification/gst/{gstin}", summary="Verify GSTIN and fetch taxpayer profile")
async def verify_gstin(gstin: str, _user: dict[str, Any] = Depends(current_user)):
    normalized = gstin.strip().upper()
    if not GSTIN_PATTERN.fullmatch(normalized):
        raise HTTPException(status_code=422, detail="Invalid GSTIN format")
    if settings.APP_ENV.lower() not in {"prod", "production", "staging"} and settings.GST_LOOKUP_MODE == "mock":
        return {
            "gstin": normalized,
            "status": "Active",
            "legal_name": "Sandbox GST Business",
            "trade_name": "Sandbox GST Business",
            "entity_type": "Proprietorship",
            "taxpayer_type": "Regular",
            "registration_date": "2024-04-01",
            "compliance_score": None,
            "registered_address": {
                "line1": "Sandbox Verification Address",
                "line2": "Development environment only",
                "city": "New Delhi",
                "state": "Delhi",
                "pincode": "110001",
            },
            "source": "development-mock",
        }
    if not settings.GST_CLEARTAX_BASE_URL or not settings.GST_CLEARTAX_AUTH_TOKEN or not settings.GST_CLEARTAX_TAXABLE_ENTITY_ID:
        raise HTTPException(status_code=503, detail="GST verification is not configured")

    url = f"{settings.GST_CLEARTAX_BASE_URL}/gst/api/v0.2/taxable_entities/{settings.GST_CLEARTAX_TAXABLE_ENTITY_ID}/gstin_verification"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url, params={"gstin": normalized}, headers={"X-Cleartax-Auth-Token": settings.GST_CLEARTAX_AUTH_TOKEN.get_secret_value()})
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="GST verification provider is unavailable") from exc
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="GSTIN could not be verified")

    profile = response.json()
    principal = profile.get("pradr") or {}
    return {
        "gstin": profile.get("gstin", normalized),
        "status": profile.get("sts"),
        "taxpayer_type": profile.get("dty"),
        "registration_date": profile.get("rgdt"),
        "compliance_score": profile.get("compliance_score"),
        "legal_name": profile.get("lgnm"),
        "trade_name": profile.get("tradeNam"),
        "entity_type": profile.get("ctb"),
        "registered_address": {
            "line1": " ".join(filter(None, [principal.get("bno"), principal.get("bnm"), principal.get("st")])),
            "line2": principal.get("loc"),
            "city": principal.get("city") or principal.get("dst"),
            "state": principal.get("stcd"),
            "pincode": principal.get("pncd"),
        },
    }


# ── Seller Organization Routes ──────────────────────────────────────────────────

@router.post(
    "/seller/organizations",
    response_model=SellerOrgResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new seller organization",
)
async def create_seller_organization(
    payload: SellerOrgCreate,
    user: dict[str, Any] = Depends(current_user),
    repo: PostgresSellerRepository = Depends(get_seller_repo),
):
    user_id = user["id"]
    if isinstance(user_id, str):
        user_id = uuid.UUID(user_id)

    try:
        org = await repo.create_organization(
            name=payload.name,
            slug=payload.slug,
            owner_user_id=user_id,
            metadata=payload.metadata,
        )
        return org
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )


@router.get(
    "/seller/organizations/me",
    response_model=list[SellerOrgResponse],
    summary="List organizations for current user",
)
async def list_my_seller_organizations(
    user: dict[str, Any] = Depends(current_user),
    repo: PostgresSellerRepository = Depends(get_seller_repo),
    identity_repo: UserRepository = Depends(get_user_repository),
):
    # Development-only fixture for exercising the verified seller portal with
    # a known Firebase identity. It is deliberately disabled for staging and
    # production and does not create or mutate a database organization.
    if (
        await is_development_mock_seller(user, identity_repo)
    ):
        now = datetime.now(timezone.utc)
        return [{
            "id": uuid.uuid5(uuid.NAMESPACE_URL, f"zolexora:mock-seller:{user['id']}"),
            "name": "Sandbox Seller Organization",
            "slug": "sandbox-seller-organization",
            "status": "ACTIVE",
            "verification_status": "VERIFIED",
            "onboarding_state": "COMPLETED",
            "metadata": {
                "source": "development-mock",
                "firebase_uid": settings.SELLER_MOCK_VERIFIED_FIREBASE_UID,
            },
            "created_at": now,
            "updated_at": now,
        }]

    user_id = user["id"]
    if isinstance(user_id, str):
        user_id = uuid.UUID(user_id)

    return await repo.list_user_organizations(user_id)


@router.get(
    "/seller/organizations/{org_id}",
    response_model=SellerOrgResponse,
    summary="Get seller organization details",
)
async def get_seller_organization(
    org_id: uuid.UUID,
    org: dict[str, Any] = Depends(require_active_seller_org),
    _member: dict[str, Any] = Depends(get_current_seller_org_member),
):
    return org


@router.post(
    "/seller/organizations/{org_id}/members/invite",
    response_model=SellerOrgMemberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Invite or add a member to the organization",
)
async def add_org_member(
    org_id: uuid.UUID,
    payload: SellerOrgMemberInvite,
    user: dict[str, Any] = Depends(current_user),
    _org: dict[str, Any] = Depends(require_active_seller_org),
    _member_role: dict[str, Any] = Depends(require_seller_org_role(["OWNER", "ADMIN"])),
    repo: PostgresSellerRepository = Depends(get_seller_repo),
):
    actor_id = user["id"]
    if isinstance(actor_id, str):
        actor_id = uuid.UUID(actor_id)

    try:
        member = await repo.add_member(
            org_id=org_id,
            user_id=payload.user_id,
            role=payload.role.upper(),
            actor_user_id=actor_id,
            permissions=payload.permissions,
        )
        return member
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.get(
    "/seller/organizations/{org_id}/members",
    response_model=list[SellerOrgMemberResponse],
    summary="List members of an organization",
)
async def list_org_members(
    org_id: uuid.UUID,
    _member: dict[str, Any] = Depends(get_current_seller_org_member),
    repo: PostgresSellerRepository = Depends(get_seller_repo),
):
    return await repo.list_org_members(org_id)


@router.put(
    "/seller/organizations/{org_id}/members/{member_id}/role",
    response_model=SellerOrgMemberResponse,
    summary="Update an organization member's role",
)
async def update_org_member_role(
    org_id: uuid.UUID,
    member_id: uuid.UUID,
    payload: SellerOrgMemberUpdateRole,
    user: dict[str, Any] = Depends(current_user),
    _org: dict[str, Any] = Depends(require_active_seller_org),
    _member_role: dict[str, Any] = Depends(require_seller_org_role(["OWNER", "ADMIN"])),
    repo: PostgresSellerRepository = Depends(get_seller_repo),
):
    actor_id = user["id"]
    if isinstance(actor_id, str):
        actor_id = uuid.UUID(actor_id)

    try:
        updated = await repo.update_member_role(
            org_id=org_id,
            member_id=member_id,
            new_role=payload.role.upper(),
            actor_user_id=actor_id,
            permissions=payload.permissions,
        )
        return updated
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.delete(
    "/seller/organizations/{org_id}/members/{member_id}",
    response_model=SellerOrgMemberResponse,
    summary="Remove a member from the organization",
)
async def remove_org_member(
    org_id: uuid.UUID,
    member_id: uuid.UUID,
    user: dict[str, Any] = Depends(current_user),
    _org: dict[str, Any] = Depends(require_active_seller_org),
    _member_role: dict[str, Any] = Depends(require_seller_org_role(["OWNER", "ADMIN"])),
    repo: PostgresSellerRepository = Depends(get_seller_repo),
):
    actor_id = user["id"]
    if isinstance(actor_id, str):
        actor_id = uuid.UUID(actor_id)

    try:
        removed = await repo.remove_member(
            org_id=org_id,
            member_id=member_id,
            actor_user_id=actor_id,
        )
        return removed
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


# ── Storefront Grant Routes (Seller Scope) ──────────────────────────────────────

@router.post(
    "/seller/organizations/{org_id}/grants",
    response_model=StorefrontGrantResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Request a publishing grant for a storefront",
)
async def request_storefront_grant(
    org_id: uuid.UUID,
    payload: StorefrontGrantRequest,
    user: dict[str, Any] = Depends(current_user),
    _org: dict[str, Any] = Depends(require_active_seller_org),
    _member_role: dict[str, Any] = Depends(require_seller_org_role(["OWNER", "ADMIN"])),
    repo: PostgresSellerRepository = Depends(get_seller_repo),
):
    actor_id = user["id"]
    if isinstance(actor_id, str):
        actor_id = uuid.UUID(actor_id)

    try:
        grant = await repo.request_storefront_grant(
            org_id=org_id,
            storefront_id=payload.storefront_id,
            actor_user_id=actor_id,
            grant_reason=payload.grant_reason,
        )
        return grant
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )


@router.get(
    "/seller/organizations/{org_id}/grants",
    response_model=list[StorefrontGrantResponse],
    summary="List storefront grants for an organization",
)
async def list_org_storefront_grants(
    org_id: uuid.UUID,
    _member: dict[str, Any] = Depends(get_current_seller_org_member),
    repo: PostgresSellerRepository = Depends(get_seller_repo),
):
    return await repo.list_org_grants(org_id)


@router.get(
    "/seller/organizations/{org_id}/audit-log",
    response_model=list[SellerAuditLogResponse],
    summary="View organization audit log",
)
async def get_org_audit_log(
    org_id: uuid.UUID,
    _member_role: dict[str, Any] = Depends(require_seller_org_role(["OWNER", "ADMIN"])),
    repo: PostgresSellerRepository = Depends(get_seller_repo),
):
    return await repo.list_audit_logs(org_id)


# ── Admin Routes ─────────────────────────────────────────────────────────────

@router.get(
    "/admin/seller-organizations",
    response_model=list[SellerOrgResponse],
    summary="Admin list all seller organizations",
)
async def admin_list_seller_organizations(
    org_status: str | None = Query(None, alias="status"),
    verification_status: str | None = Query(None),
    _admin: dict[str, Any] = Depends(admin_only),
    repo: PostgresSellerRepository = Depends(get_seller_repo),
):
    return await repo.list_all_organizations(
        status=org_status,
        verification_status=verification_status,
    )


@router.get(
    "/admin/seller-organizations/{org_id}",
    response_model=SellerOrgResponse,
    summary="Admin get seller organization details",
)
async def admin_get_seller_organization(
    org_id: uuid.UUID,
    _admin: dict[str, Any] = Depends(admin_only),
    repo: PostgresSellerRepository = Depends(get_seller_repo),
):
    org = await repo.get_organization_by_id(org_id)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization {org_id} not found",
        )
    return org


@router.put(
    "/admin/seller-organizations/{org_id}/verification",
    response_model=SellerOrgResponse,
    summary="Admin update organization verification status",
)
async def admin_update_organization_verification(
    org_id: uuid.UUID,
    payload: AdminVerificationUpdate,
    user: dict[str, Any] = Depends(admin_only),
    repo: PostgresSellerRepository = Depends(get_seller_repo),
):
    admin_id = user["id"]
    if isinstance(admin_id, str):
        admin_id = uuid.UUID(admin_id)

    try:
        org = await repo.update_organization_verification(
            org_id=org_id,
            verification_status=payload.verification_status,
            admin_user_id=admin_id,
            notes=payload.notes,
        )
        return org
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.put(
    "/admin/seller-organizations/{org_id}/suspension",
    response_model=SellerOrgResponse,
    summary="Admin suspend or unsuspend organization",
)
async def admin_update_organization_suspension(
    org_id: uuid.UUID,
    payload: AdminSuspensionUpdate,
    user: dict[str, Any] = Depends(admin_only),
    repo: PostgresSellerRepository = Depends(get_seller_repo),
):
    admin_id = user["id"]
    if isinstance(admin_id, str):
        admin_id = uuid.UUID(admin_id)

    target_status = "SUSPENDED" if payload.action.upper() == "SUSPEND" else "ACTIVE"

    try:
        org = await repo.update_organization_status(
            org_id=org_id,
            status=target_status,
            actor_user_id=admin_id,
            reason=payload.reason,
        )
        return org
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.get(
    "/admin/storefront-grants",
    response_model=list[StorefrontGrantResponse],
    summary="Admin list publishing grants",
)
async def admin_list_storefront_grants(
    grant_status: str | None = Query(None, alias="status"),
    storefront_id: uuid.UUID | None = Query(None),
    organization_id: uuid.UUID | None = Query(None),
    _admin: dict[str, Any] = Depends(admin_only),
    repo: PostgresSellerRepository = Depends(get_seller_repo),
):
    return await repo.list_all_grants(
        status=grant_status,
        storefront_id=storefront_id,
        org_id=organization_id,
    )


@router.put(
    "/admin/storefront-grants/{grant_id}/decision",
    response_model=StorefrontGrantResponse,
    summary="Admin decide (approve, revoke, suspend) on a publishing grant",
)
async def admin_decide_storefront_grant(
    grant_id: uuid.UUID,
    payload: StorefrontGrantDecision,
    user: dict[str, Any] = Depends(admin_only),
    repo: PostgresSellerRepository = Depends(get_seller_repo),
):
    admin_id = user["id"]
    if isinstance(admin_id, str):
        admin_id = uuid.UUID(admin_id)

    try:
        grant = await repo.update_grant_status(
            grant_id=grant_id,
            decision=payload.decision,
            admin_user_id=admin_id,
            reason=payload.reason,
        )
        return grant
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.get(
    "/admin/seller-organizations/{org_id}/verification-history",
    response_model=list[SellerVerificationHistoryResponse],
    summary="Admin view organization verification history",
)
async def admin_get_verification_history(
    org_id: uuid.UUID,
    _admin: dict[str, Any] = Depends(admin_only),
    repo: PostgresSellerRepository = Depends(get_seller_repo),
):
    return await repo.list_verification_history(org_id)
