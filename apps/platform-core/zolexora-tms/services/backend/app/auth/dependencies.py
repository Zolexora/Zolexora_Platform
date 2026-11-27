from collections import OrderedDict
import logging
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Set
import uuid
from fastapi import Depends, HTTPException, Security, status, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.tenant import TenantContext
from app.core.config import settings
from app.modules.core.platform.models import ProviderType
from app.auth.catalog import expand_auth_permissions, to_auth_permission
from app.auth.zolexora import AuthServiceError, InvalidToken, introspect
from app.db.session import AsyncSessionLocal, get_db, rls_bypass, set_tenant_context

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

class AuthenticatedIdentity(BaseModel):
    """The caller as the Zolexora auth service knows them."""
    id: uuid.UUID
    email: Optional[str] = None
    full_name: Optional[str] = None
    zolexora_id: Optional[str] = None
    phone_number: Optional[str] = None
    member_kind: Optional[str] = None
    # ZX-ORG id for business-session / employee logins; None for Track 1 personal tokens
    zolexora_org_id: Optional[str] = None
    org_name: Optional[str] = None
    business_kind: Optional[str] = None
    auth_role: Optional[str] = None
    auth_permissions: List[str] = Field(default_factory=list)
    mfa_setup_required: bool = False
    verification: Dict[str, Any] = Field(default_factory=dict)
    is_business_session: bool = False
    is_platform_admin: bool = False

_PERMISSION_ALIASES = {"users.manage": "identity.users.manage"}


class AuthenticatedUser(AuthenticatedIdentity):
    organisation_id: uuid.UUID
    member_id: Optional[uuid.UUID] = None
    workspace_type: Optional[str] = None
    is_creator: bool = False
    is_commander: bool = False
    role_code: Optional[str] = None
    permissions: Set[str] = Field(default_factory=set)

    @property
    def user_id(self) -> uuid.UUID:
        return self.id

    def has_permission(self, permission: str) -> bool:
        if self.is_commander:
            return True
        if permission in self.permissions:
            return True
        alias = _PERMISSION_ALIASES.get(permission)
        if alias and alias in self.permissions:
            return True
        auth_perm = to_auth_permission(permission)
        return auth_perm in self.permissions

CurrentUserContext = AuthenticatedUser


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail, headers={"WWW-Authenticate": "Bearer"})


async def identity_from_token(token: str) -> AuthenticatedIdentity:
    try:
        user = await introspect(token)
    except InvalidToken as e:
        logger.info(f"Rejected authorization token: {e}")
        raise _unauthorized("Invalid or expired authorization token")
    except AuthServiceError as e:
        logger.error(f"Auth service unavailable: {e}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication service unavailable")
    try:
        user_id = uuid.UUID(str(user["uid"]))
    except ValueError:
        raise _unauthorized("Invalid user id in token")
    return AuthenticatedIdentity(
        id=user_id,
        email=user.get("email"),
        full_name=user.get("display_name") or user.get("name") or user.get("full_name"),
        zolexora_id=user.get("zolexora_id"),
        phone_number=user.get("phone_number"),
        member_kind=user.get("kind"),
        zolexora_org_id=user.get("org_id") or None,
        org_name=user.get("org_name"),
        business_kind=user.get("business_kind"),
        auth_role=user.get("role"),
        auth_permissions=list(user.get("permissions") or []),
        mfa_setup_required=bool(user.get("mfa_setup_required")),
        verification=user.get("verification") or {},
        is_business_session=bool(user.get("is_business_session")),
        is_platform_admin=user.get("is_platform_admin") is True,
    )


async def get_current_identity(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> AuthenticatedIdentity:
    if not credentials:
        raise _unauthorized("Authorization credentials were not provided")
    return await identity_from_token(credentials.credentials)


_KNOWN_PROFILES_MAX = 10_000
_known_profiles: OrderedDict[uuid.UUID, None] = OrderedDict()


async def ensure_profile(identity: AuthenticatedIdentity) -> None:
    """profiles.id is referenced by audit columns (verified_by, closed_by...): make sure the row
    exists. Own committed session, so a failing request can't roll it back behind the cache."""
    if identity.id in _known_profiles:
        _known_profiles.move_to_end(identity.id)
        return
    name = (identity.full_name or (identity.email or "").split("@")[0] or f"User {identity.id.hex[:8]}").strip()
    if len(name) < 2:
        name = f"User {identity.id.hex[:8]}"
    async with AsyncSessionLocal() as db, db.begin(), rls_bypass(db):
        await db.execute(
            text("""
                INSERT INTO public.profiles (id, full_name, created_at, updated_at)
                VALUES (:id, :name, NOW(), NOW()) ON CONFLICT (id) DO NOTHING
            """),
            {"id": identity.id, "name": name[:160]},
        )
    if len(_known_profiles) >= _KNOWN_PROFILES_MAX:
        _known_profiles.popitem(last=False)
    _known_profiles[identity.id] = None


_MEMBER_COLUMNS = (
    "m.id AS member_id, m.organisation_id, m.is_creator, m.is_commander, "
    "o.workspace_type::text AS workspace_type, o.zolexora_org_id AS zolexora_org_id, "
    "o.name AS org_name, o.organisation_type AS org_type, "
    "o.status::text AS org_status, o.created_at AS org_created_at, o.updated_at AS org_updated_at"
)


async def resolve_membership(
    db: AsyncSession, identity: AuthenticatedIdentity, requested_org_id: Optional[uuid.UUID]
) -> Optional[Dict[str, Any]]:
    """The caller's ACTIVE membership, or None.

    Employee logins (ZX-ORG in the token) belong to exactly the TMS organisation linked to
    that ZX-ORG by a platform admin; the auth service vouches for org membership, so the
    TMS membership is created on first login. X-Organization-Id is ignored for them.
    Public users pick among their memberships with X-Organization-Id (default: oldest).
    """
    async with rls_bypass(db):
        if identity.zolexora_org_id:
            row = (await db.execute(
                text(
                    f"SELECT {_MEMBER_COLUMNS} FROM public.organisation_members m "
                    "JOIN public.organisations o ON o.id = m.organisation_id "
                    "WHERE m.user_id = :u AND o.zolexora_org_id = :z "
                    "AND o.status = 'ACTIVE' AND m.status = 'ACTIVE' LIMIT 1"
                ),
                {"u": identity.id, "z": identity.zolexora_org_id},
            )).mappings().first()
            if row:
                return dict(row)
            # First employee login: auto-provision membership once when the org is linked.
            org = (await db.execute(
                text("SELECT id FROM public.organisations WHERE zolexora_org_id = :z AND status = 'ACTIVE'"),
                {"z": identity.zolexora_org_id},
            )).scalar()
            if not org:
                return None
            await db.execute(
                text("""
                    INSERT INTO public.organisation_members
                        (id, organisation_id, user_id, status, is_creator, is_commander, created_at, updated_at)
                    VALUES (:id, :o, :u, 'ACTIVE', false, false, NOW(), NOW())
                    ON CONFLICT (organisation_id, user_id) DO NOTHING
                """),
                {"id": uuid.uuid4(), "o": org, "u": identity.id},
            )
            query, params = (
                f"SELECT {_MEMBER_COLUMNS} FROM public.organisation_members m "
                "JOIN public.organisations o ON o.id = m.organisation_id "
                "WHERE m.user_id = :u AND m.organisation_id = :o AND m.status = 'ACTIVE'",
                {"u": identity.id, "o": org},
            )
        elif requested_org_id:
            query, params = (
                f"SELECT {_MEMBER_COLUMNS} FROM public.organisation_members m "
                "JOIN public.organisations o ON o.id = m.organisation_id "
                "WHERE m.user_id = :u AND m.organisation_id = :o AND m.status = 'ACTIVE'",
                {"u": identity.id, "o": requested_org_id},
            )
        else:
            query, params = (
                f"SELECT {_MEMBER_COLUMNS} FROM public.organisation_members m "
                "JOIN public.organisations o ON o.id = m.organisation_id "
                "WHERE m.user_id = :u AND m.status = 'ACTIVE' ORDER BY m.created_at ASC LIMIT 1",
                {"u": identity.id},
            )
        row = (await db.execute(text(query), params)).mappings().first()
    return dict(row) if row else None


def requested_org(request: Request) -> Optional[uuid.UUID]:
    raw = request.headers.get("X-Organization-Id")
    if not raw:
        return None
    try:
        return uuid.UUID(raw)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid X-Organization-Id header format")


async def get_current_active_organisation(
    request: Request,
    identity: AuthenticatedIdentity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db),
) -> AuthenticatedUser:
    """Validates organisation membership and sets the RLS tenant for this transaction."""
    await ensure_profile(identity)
    row = await resolve_membership(db, identity, requested_org(request))
    if not row:
        if identity.zolexora_org_id:
            detail = "Your Zolexora organisation is not linked to a TMS workspace, or your access is suspended."
        else:
            detail = "Access denied: no active membership in the requested organisation. Onboarding required."
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)

    await set_tenant_context(db, row["organisation_id"])
    is_commander = bool(row["is_commander"]) or (
        identity.is_business_session and identity.auth_role == "owner"
    )
    permissions = (
        set(expand_auth_permissions(identity.auth_permissions))
        if identity.is_business_session
        else set()
    )
    return AuthenticatedUser(
        **identity.model_dump(),
        organisation_id=row["organisation_id"],
        member_id=row.get("member_id"),
        workspace_type=row.get("workspace_type"),
        is_creator=row["is_creator"],
        is_commander=is_commander,
        role_code=identity.auth_role if identity.is_business_session else None,
        permissions=permissions,
    )

@dataclass
class OrgContext:
    """Request-scoped tenant context for Postgres-backed services (RLS is already set on `db`)."""
    organisation_id: uuid.UUID
    user_id: uuid.UUID
    db: AsyncSession


async def get_org_context(
    user: AuthenticatedUser = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db),
) -> OrgContext:
    return OrgContext(organisation_id=user.organisation_id, user_id=user.id, db=db)


async def get_current_user(user: AuthenticatedUser = Depends(get_current_active_organisation)) -> AuthenticatedUser:
    # Alias to not break legacy routes
    return user

async def _resolve_member_permissions(
    db: AsyncSession, org_id: uuid.UUID, member_id: uuid.UUID
) -> tuple[Optional[str], set[str]]:
    """Loads active role permissions + user overrides for a non-commander member."""
    from app.modules.identity.roles.models import (
        OrganisationRoleVersion,
        OverrideType,
        RoleAssignment,
        UserPermissionOverride,
    )

    assign_stmt = (
        select(RoleAssignment)
        .where(
            RoleAssignment.organisation_id == org_id,
            RoleAssignment.member_id == member_id,
            RoleAssignment.is_active == True,
        )
        .options(
            joinedload(RoleAssignment.role_version).selectinload(OrganisationRoleVersion.permissions),
            joinedload(RoleAssignment.role),
        )
    )
    assignment = (await db.execute(assign_stmt)).scalar_one_or_none()
    caps: set[str] = set()
    role_name = assignment.role.name if assignment and assignment.role else None
    if assignment and assignment.role_version:
        for p in assignment.role_version.permissions:
            caps.add(f"{p.module_code}.{p.page_code}.{p.action_code}")

    override_stmt = select(UserPermissionOverride).where(
        UserPermissionOverride.organisation_id == org_id,
        UserPermissionOverride.member_id == member_id,
    )
    for ov in (await db.execute(override_stmt)).scalars().all():
        cap = f"{ov.module_code}.{ov.page_code}.{ov.action_code}"
        if ov.override_type == OverrideType.GRANT:
            caps.add(cap)
        elif ov.override_type == OverrideType.RESTRICT:
            caps.discard(cap)

    return role_name, caps


def require_permission(permission: str) -> Callable:
    async def dependency(
        user: AuthenticatedUser = Depends(get_current_active_organisation),
        db: AsyncSession = Depends(get_db),
    ) -> AuthenticatedUser:
        if not user.is_business_session and not user.is_commander and not user.permissions and user.member_id:
            role_name, caps = await _resolve_member_permissions(db, user.organisation_id, user.member_id)
            user.role_code = role_name
            user.permissions = caps
        if not user.has_permission(permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions: '{permission}' required",
            )
        return user
    return dependency

async def require_commander(user: AuthenticatedUser = Depends(get_current_active_organisation)) -> AuthenticatedUser:
    """Requires the user to be the Commander of the organisation (not a role check)."""
    if not user.is_commander:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the Commander can perform this action",
        )
    return user

async def get_tenant_context(
    user: AuthenticatedUser = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db),
) -> TenantContext:
    query = text("""
        SELECT 
            da.assignment_status,
            dr.provider as db_provider,
            dr.database_identifier,
            mr.cluster_identifier,
            ma.database_name as mongo_db_name,
            sa.cloudinary_folder_prefix,
            sa.r2_bucket,
            sa.r2_prefix
        FROM public.organisation_database_assignments da
        JOIN public.tenant_database_registry dr ON dr.id = da.database_registry_id
        LEFT JOIN public.organisation_mongodb_assignments ma ON ma.organisation_id = da.organisation_id AND ma.status = 'ACTIVE'
        LEFT JOIN public.tenant_mongodb_registry mr ON mr.id = ma.mongodb_registry_id
        LEFT JOIN public.organisation_storage_assignments sa ON sa.organisation_id = da.organisation_id
        WHERE da.organisation_id = :org_id AND da.assignment_status = 'ACTIVE'
        LIMIT 1
    """)
    
    result = await db.execute(query, {"org_id": user.organisation_id})
    row = result.mappings().first()
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant infrastructure is not fully provisioned for this organisation.",
        )
        
    return TenantContext(
        organisation_id=user.organisation_id,
        tenant_database_provider=ProviderType(row["db_provider"]),
        tenant_database_identifier=row["database_identifier"],
        mongodb_cluster_identifier=row["cluster_identifier"],
        mongodb_database_name=row["mongo_db_name"],
        cloudinary_prefix=row["cloudinary_folder_prefix"] or f"zolexora/organisations/{user.organisation_id}/",
        r2_bucket=row["r2_bucket"] or settings.R2_BUCKET_NAME,
        r2_prefix=row["r2_prefix"],
        user_id=user.id,
        role_code="CREATOR" if user.is_creator else "MEMBER",
        permissions=[]
    )

async def require_platform_admin(identity: AuthenticatedIdentity = Depends(get_current_identity)) -> AuthenticatedIdentity:
    """Platform admins are the auth service's is_platform_admin users; no organisation context."""
    if not identity.is_platform_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Platform Administrators can perform this action",
        )
    return identity
