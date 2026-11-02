from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
import uuid
from typing import List, Optional

from app.auth.dependencies import (
    AuthenticatedIdentity,
    AuthenticatedUser,
    ensure_profile,
    get_current_identity,
    get_current_user,
    requested_org,
    resolve_membership,
)
from app.db.session import get_db, rls_bypass
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


class UserMeResponse(BaseModel):
    """The caller, plus their active TMS membership if any (null organisation = onboarding needed).
    Full effective permissions: /api/v1/organisations/me/effective-permissions."""
    id: uuid.UUID
    user_id: uuid.UUID  # alias used by the frontends
    email: Optional[str]
    full_name: Optional[str]
    organisation_id: Optional[uuid.UUID]
    zolexora_org_id: Optional[str] = None
    is_creator: bool
    is_commander: bool
    is_platform_admin: bool = False
    role_code: Optional[str] = None


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
    await db.commit()
    return UserMeResponse(
        id=identity.id,
        user_id=identity.id,
        email=identity.email,
        full_name=identity.full_name,
        organisation_id=row["organisation_id"] if row else None,
        zolexora_org_id=identity.zolexora_org_id,
        is_creator=row["is_creator"] if row else False,
        is_commander=row["is_commander"] if row else False,
        is_platform_admin=identity.is_platform_admin,
        role_code=("CREATOR" if row["is_creator"] else "MEMBER") if row else None,
    )


from app.modules.identity.organisations.models import Organisation
from app.modules.identity.organisations.membership_models import OrganisationMember, MemberStatus
from sqlalchemy import select


class UserOrganisationResponse(BaseModel):
    id: uuid.UUID
    name: str
    is_creator: bool
    is_commander: bool


@router.get("/my-organisations", response_model=List[UserOrganisationResponse])
async def get_my_organisations(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Organisation, OrganisationMember)
        .join(OrganisationMember, OrganisationMember.organisation_id == Organisation.id)
        .where(
            OrganisationMember.user_id == user.id,
            OrganisationMember.status == MemberStatus.ACTIVE
        )
    )
    async with rls_bypass(db):  # lists the caller's memberships across organisations
        res = await db.execute(stmt)
    rows = res.all()
    return [
        UserOrganisationResponse(
            id=org.id,
            name=org.name,
            is_creator=member.is_creator,
            is_commander=member.is_commander,
        ) for org, member in rows
    ]
