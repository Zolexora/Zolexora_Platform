from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
import uuid
from typing import List, Optional
from sqlalchemy import text

from app.auth.dependencies import AuthenticatedIdentity, get_current_identity, AuthenticatedUser, get_current_user
from app.db.session import get_db, rls_bypass
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


class UserMeResponse(BaseModel):
    """
    Auth context returned after successful token verification.
    Includes Commander flag and is_creator for the UI.
    For full effective permissions, call /api/v1/organisations/me/effective-permissions.
    """
    id: uuid.UUID
    # frontend uses user_id as alias
    user_id: uuid.UUID
    email: Optional[str]
    full_name: Optional[str]
    organisation_id: Optional[uuid.UUID]
    is_creator: bool
    is_commander: bool
    # role_code is null until roles are assigned (Prompt 07+)
    role_code: Optional[str] = None


@router.get("/me", response_model=UserMeResponse)
async def get_current_user_profile(
    request: Request,
    identity: AuthenticatedIdentity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db),
):
    requested_org_id_str = request.headers.get("X-Organization-Id")
    row = None
    if requested_org_id_str:
        try:
            requested_org_id = uuid.UUID(requested_org_id_str)
            query = text("""
                SELECT 
                    m.organisation_id,
                    m.is_creator,
                    m.is_commander
                FROM public.organisation_members m
                WHERE m.user_id = :user_id AND m.organisation_id = :org_id AND m.status = 'ACTIVE'
            """)
            async with rls_bypass(db):
                result = await db.execute(query, {"user_id": identity.id, "org_id": requested_org_id})
            row = result.mappings().first()
        except ValueError:
            pass

    if not row:
        query = text("""
            SELECT 
                m.organisation_id,
                m.is_creator,
                m.is_commander
            FROM public.organisation_members m
            WHERE m.user_id = :user_id AND m.status = 'ACTIVE'
            ORDER BY m.created_at ASC
            LIMIT 1
        """)
        async with rls_bypass(db):
            result = await db.execute(query, {"user_id": identity.id})
        row = result.mappings().first()

    return UserMeResponse(
        id=identity.id,
        user_id=identity.id,
        email=identity.email,
        full_name=identity.full_name,
        organisation_id=row["organisation_id"] if row else None,
        is_creator=row["is_creator"] if row else False,
        is_commander=row["is_commander"] if row else False,
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
