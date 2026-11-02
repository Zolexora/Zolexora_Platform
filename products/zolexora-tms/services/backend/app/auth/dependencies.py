import logging
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional
import uuid
from fastapi import Depends, HTTPException, Security, status, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenant import TenantContext
from app.core.config import settings
from app.modules.core.platform.models import ProviderType
from app.auth.zolexora import AuthServiceError, InvalidToken, introspect
from app.db.session import AsyncSessionLocal, get_db, rls_bypass, set_tenant_context

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

class AuthenticatedIdentity(BaseModel):
    """The caller as the Zolexora auth service knows them."""
    id: uuid.UUID
    email: Optional[str] = None
    full_name: Optional[str] = None
    # ZX-ORG id for employee-track (org) logins; None for public users
    zolexora_org_id: Optional[str] = None
    is_platform_admin: bool = False

class AuthenticatedUser(AuthenticatedIdentity):
    organisation_id: uuid.UUID
    is_creator: bool = False
    is_commander: bool = False
    role_code: Optional[str] = None
    permissions: List[str] = []

    @property
    def user_id(self) -> uuid.UUID:
        return self.id

    def has_permission(self, permission: str) -> bool:
        if self.is_commander:
            return True
        return permission in self.permissions

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
        full_name=user.get("name") or user.get("full_name"),
        zolexora_org_id=user.get("org_id") or None,
        is_platform_admin=user.get("is_platform_admin") is True,
    )


async def get_current_identity(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> AuthenticatedIdentity:
    if not credentials:
        raise _unauthorized("Authorization credentials were not provided")
    return await identity_from_token(credentials.credentials)


_known_profiles: set[uuid.UUID] = set()


async def ensure_profile(identity: AuthenticatedIdentity) -> None:
    """profiles.id is referenced by audit columns (verified_by, closed_by...): make sure the row
    exists. Own committed session, so a failing request can't roll it back behind the cache."""
    if identity.id in _known_profiles:
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
    _known_profiles.add(identity.id)


_MEMBER_COLUMNS = "m.organisation_id, m.is_creator, m.is_commander"


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
                "WHERE m.user_id = :u AND m.organisation_id = :o AND m.status = 'ACTIVE'",
                {"u": identity.id, "o": org},
            )
        elif requested_org_id:
            query, params = (
                f"SELECT {_MEMBER_COLUMNS} FROM public.organisation_members m "
                "WHERE m.user_id = :u AND m.organisation_id = :o AND m.status = 'ACTIVE'",
                {"u": identity.id, "o": requested_org_id},
            )
        else:
            query, params = (
                f"SELECT {_MEMBER_COLUMNS} FROM public.organisation_members m "
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
    return AuthenticatedUser(
        **identity.model_dump(),
        organisation_id=row["organisation_id"],
        is_creator=row["is_creator"],
        is_commander=row["is_commander"],
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

def require_permission(permission: str) -> Callable:
    async def dependency(user: AuthenticatedUser = Depends(get_current_active_organisation)) -> AuthenticatedUser:
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
