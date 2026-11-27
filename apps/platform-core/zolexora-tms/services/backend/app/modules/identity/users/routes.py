from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
import uuid
from typing import Any, Dict, List, Optional

from app.auth.catalog import expand_auth_permissions
from app.auth.dependencies import (
    AuthenticatedIdentity,
    ensure_profile,
    get_current_identity,
    requested_org,
    resolve_membership,
)
from app.db.session import get_db, rls_bypass, set_tenant_context
from app.modules.core.customization.schemas import RuntimeConfiguration
from app.modules.core.customization.service import ApplicationRuntimeService
from app.modules.crm.vendors.routes import find_vendor_for_caller
from app.modules.crm.vendors.schemas import VendorResponse
from app.modules.fleet.drivers.routes import find_driver_for_caller
from app.modules.fleet.drivers.schemas import DriverResponse
from app.modules.identity.organisations.models import Organisation
from app.modules.identity.organisations.membership_models import OrganisationMember, MemberStatus
from app.modules.identity.organisations.schemas import OrganisationResponse
from app.modules.identity.roles.schemas import EffectivePermissionsResponse
from app.modules.identity.roles.service import _build_structured, resolve_effective_permissions
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


class UserMeResponse(BaseModel):
    """The caller, plus their active TMS membership if any (null organisation = onboarding needed).
    Full effective permissions: /api/v1/organisations/me/effective-permissions."""
    id: uuid.UUID
    user_id: uuid.UUID  # alias used by the frontends
    email: Optional[str]
    full_name: Optional[str]
    zolexora_id: Optional[str] = None
    phone_number: Optional[str] = None
    member_kind: Optional[str] = None
    organisation_id: Optional[uuid.UUID]
    workspace_type: Optional[str] = None
    zolexora_org_id: Optional[str] = None
    org_name: Optional[str] = None
    business_kind: Optional[str] = None
    is_creator: bool
    is_commander: bool
    is_platform_admin: bool = False
    is_business_session: bool = False
    mfa_setup_required: bool = False
    verification: Dict[str, Any] = Field(default_factory=dict)
    role_code: Optional[str] = None


class AuthBootstrapResponse(BaseModel):
    me: UserMeResponse
    organisation: Optional[OrganisationResponse] = None
    effective_permissions: Optional[EffectivePermissionsResponse] = None
    runtime: Optional[RuntimeConfiguration] = None


class MobileBootstrapResponse(AuthBootstrapResponse):
    driver: Optional[DriverResponse] = None
    vendor: Optional[VendorResponse] = None


def _build_user_me(identity: AuthenticatedIdentity, row: Optional[dict]) -> UserMeResponse:
    is_commander = bool(row and row["is_commander"]) or (
        identity.is_business_session and identity.auth_role == "owner"
    )
    role_code = identity.auth_role if identity.is_business_session else (
        ("CREATOR" if row["is_creator"] else "MEMBER") if row else None
    )
    return UserMeResponse(
        id=identity.id,
        user_id=identity.id,
        email=identity.email,
        full_name=identity.full_name,
        zolexora_id=identity.zolexora_id,
        phone_number=identity.phone_number,
        member_kind=identity.member_kind,
        organisation_id=row["organisation_id"] if row else None,
        workspace_type=row.get("workspace_type") if row else None,
        zolexora_org_id=(row.get("zolexora_org_id") if row else None) or identity.zolexora_org_id,
        org_name=identity.org_name,
        business_kind=identity.business_kind,
        is_creator=row["is_creator"] if row else False,
        is_commander=is_commander,
        is_platform_admin=identity.is_platform_admin,
        is_business_session=identity.is_business_session,
        mfa_setup_required=identity.mfa_setup_required,
        verification=identity.verification,
        role_code=role_code,
    )


@router.get("/me", response_model=UserMeResponse)
async def get_current_user_profile(
    request: Request,
    identity: AuthenticatedIdentity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db),
):
    await ensure_profile(identity)
    row = await resolve_membership(db, identity, requested_org(request))
    if row is None and not identity.zolexora_org_id and request.headers.get("X-Organization-Id"):
        # A stale org selection should not lock the user out of their default workspace
        row = await resolve_membership(db, identity, None)
    return _build_user_me(identity, row)


@router.get("/bootstrap", response_model=AuthBootstrapResponse)
async def get_auth_bootstrap(
    request: Request,
    identity: AuthenticatedIdentity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db),
):
    """Single-round-trip session bootstrap: me + active organisation + permissions + runtime config."""
    await ensure_profile(identity)
    row = await resolve_membership(db, identity, requested_org(request))
    if row is None and not identity.zolexora_org_id and request.headers.get("X-Organization-Id"):
        row = await resolve_membership(db, identity, None)

    me = _build_user_me(identity, row)
    if not row or not row.get("organisation_id"):
        return AuthBootstrapResponse(me=me)

    org_id = row["organisation_id"]
    if identity.is_business_session and identity.org_name and row.get("org_name") and row["org_name"] != identity.org_name:
        async with rls_bypass(db):
            from sqlalchemy import update as sa_update
            await db.execute(
                sa_update(Organisation).where(Organisation.id == org_id).values(name=identity.org_name[:160])
            )
        row["org_name"] = identity.org_name[:160]

    if "org_name" in row:
        organisation = OrganisationResponse(
            id=org_id,
            name=row["org_name"],
            organisation_type=row["org_type"],
            workspace_type=row["workspace_type"],
            status=row["org_status"],
            zolexora_org_id=row.get("zolexora_org_id") or identity.zolexora_org_id,
            created_at=row["org_created_at"],
            updated_at=row["org_updated_at"],
        )
    else:
        await set_tenant_context(db, org_id)
        org_obj = (await db.execute(select(Organisation).where(Organisation.id == org_id))).scalars().first()
        organisation = OrganisationResponse.model_validate(org_obj) if org_obj else None

    runtime: Optional[RuntimeConfiguration] = ApplicationRuntimeService.get_cached_runtime(org_id)
    is_commander = bool(row["is_commander"]) or (
        identity.is_business_session and identity.auth_role == "owner"
    )
    needs_tenant_ctx = "org_name" in row and ((not is_commander and not identity.is_business_session) or runtime is None)
    if needs_tenant_ctx:
        await set_tenant_context(db, org_id)

    if identity.is_business_session:
        if is_commander:
            effective_permissions = await resolve_effective_permissions(
                org_id,
                identity.id,
                db,
                member_id=row.get("member_id"),
                is_commander=True,
            )
            effective_permissions.permissions = sorted(
                set(effective_permissions.permissions) | set(identity.auth_permissions)
            )
        else:
            expanded = expand_auth_permissions(identity.auth_permissions)
            effective_permissions = EffectivePermissionsResponse(
                user_id=identity.id,
                organisation_id=org_id,
                is_commander=False,
                role_name=identity.auth_role,
                permissions=expanded,
                modules=_build_structured([p for p in expanded if "." in p]),
            )
    else:
        effective_permissions = await resolve_effective_permissions(
            org_id,
            identity.id,
            db,
            member_id=row.get("member_id"),
            is_commander=is_commander,
        )

    if runtime is None:
        try:
            runtime = await ApplicationRuntimeService.get_runtime_configuration(db, org_id)
        except HTTPException as exc:
            if exc.status_code != 404:
                raise

    return AuthBootstrapResponse(
        me=me,
        organisation=organisation,
        effective_permissions=effective_permissions,
        runtime=runtime,
    )


@router.get("/mobile-bootstrap", response_model=MobileBootstrapResponse)
async def get_mobile_auth_bootstrap(
    request: Request,
    identity: AuthenticatedIdentity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db),
):
    """Single-round-trip mobile bootstrap: org/permissions/runtime + optional linked Driver/Vendor profiles."""
    base = await get_auth_bootstrap(request=request, identity=identity, db=db)
    org_id = base.me.organisation_id
    if not org_id or (not identity.email and not identity.phone_number):
        return MobileBootstrapResponse(**base.model_dump())

    await set_tenant_context(db, org_id)
    driver_obj = await find_driver_for_caller(db, org_id, identity.email, identity.phone_number)
    vendor_obj = await find_vendor_for_caller(db, org_id, identity.email, identity.phone_number)

    return MobileBootstrapResponse(
        **base.model_dump(),
        driver=DriverResponse.model_validate(driver_obj) if driver_obj else None,
        vendor=VendorResponse.model_validate(vendor_obj) if vendor_obj else None,
    )


class UserOrganisationResponse(BaseModel):
    id: uuid.UUID
    name: str
    organisation_type: Optional[str] = None
    workspace_type: str = "SERVICE_PROVIDER"
    is_creator: bool
    is_commander: bool


@router.get("/my-organisations", response_model=List[UserOrganisationResponse])
async def get_my_organisations(
    user: AuthenticatedIdentity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db)
):
    """Every organisation the caller is an active member of (empty before onboarding)."""
    await ensure_profile(user)
    stmt = (
        select(Organisation, OrganisationMember)
        .join(OrganisationMember, OrganisationMember.organisation_id == Organisation.id)
        .where(
            OrganisationMember.user_id == user.id,
            OrganisationMember.status == MemberStatus.ACTIVE
        )
        .order_by(OrganisationMember.created_at.asc())
    )
    async with rls_bypass(db):  # lists the caller's memberships across organisations
        res = await db.execute(stmt)
    rows = res.all()
    return [
        UserOrganisationResponse(
            id=org.id,
            name=org.name,
            organisation_type=org.organisation_type,
            workspace_type=org.workspace_type.value if hasattr(org.workspace_type, "value") else str(org.workspace_type),
            is_creator=member.is_creator,
            is_commander=member.is_commander,
        ) for org, member in rows
    ]
