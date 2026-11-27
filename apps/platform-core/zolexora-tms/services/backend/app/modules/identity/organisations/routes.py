from fastapi import APIRouter, Depends, HTTPException, Request, status
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    AuthenticatedIdentity,
    ensure_profile,
    get_current_identity,
    AuthenticatedUser,
    get_current_user,
    require_commander,
    require_permission,
)
from app.auth.zolexora import auth_service_url
from app.core.config import settings
from app.db.session import get_db, rls_bypass
from app.modules.identity.organisations.models import Organisation
from app.modules.identity.organisations.schemas import (
    InvitationResponse,
    MemberInviteRequest,
    MemberResponse,
    OnboardingRequest,
    OnboardingResponse,
    OrganisationResponse,
    CommanderTransferRequest,
    ZolexoraOrgLinkRequest,
)
from app.modules.identity.organisations.service import (
    complete_onboarding,
    get_organisation_by_id,
    invite_member,
    list_organisation_members,
    transfer_commander,
)

router = APIRouter(prefix="/api/v1", tags=["Organisations & Onboarding"])


@router.post("/onboarding", response_model=OnboardingResponse, status_code=status.HTTP_201_CREATED)
async def create_organisation_and_commander(
    request: Request,
    req: OnboardingRequest,
    user: AuthenticatedIdentity = Depends(get_current_identity),
    db: AsyncSession = Depends(get_db),
):
    if user.zolexora_org_id:
        if not user.is_business_session:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Organisation logins use the workspace linked to their Zolexora organisation",
            )
        if user.auth_role != "owner" and "org:profile:edit" not in user.auth_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only a business owner or admin can initialize the TMS workspace.",
            )
    await ensure_profile(user)
    ip_addr = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")
    return await complete_onboarding(
        user_id=user.id,
        req=req,
        db=db,
        ip_address=ip_addr,
        user_agent=user_agent,
        zolexora_org_id=user.zolexora_org_id,
    )


@router.post("/organisations/me/link-zolexora-org", response_model=OrganisationResponse)
async def link_my_zolexora_org(
    request: Request,
    body: ZolexoraOrgLinkRequest,
    user: AuthenticatedUser = Depends(require_commander),
    db: AsyncSession = Depends(get_db),
):
    """Links an existing TMS workspace to its centralised auth-service business (verified via caller token)."""
    zx_org_id = body.zolexora_org_id.strip().upper()
    org_name = body.name.strip() if body.name else None

    if settings.ENVIRONMENT != "test":
        base = auth_service_url()
        auth_header = request.headers.get("Authorization")
        if not base or not auth_header:
            raise HTTPException(status_code=503, detail="Auth service unavailable")
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(
                    f"{base}/api/v1/organizations/{zx_org_id}",
                    headers={"Authorization": auth_header},
                )
        except httpx.HTTPError:
            raise HTTPException(status_code=503, detail="Auth service unreachable")
        if res.status_code in (401, 403, 404):
            raise HTTPException(status_code=403, detail="You do not have access to that Zolexora business.")
        if res.status_code != 200:
            raise HTTPException(status_code=503, detail="Could not verify Zolexora business.")
        payload = res.json() or {}
        if payload.get("role") not in ("owner", "admin"):
            raise HTTPException(status_code=403, detail="Only a business owner or admin can link this workspace.")
        org_name = org_name or (payload.get("organization") or {}).get("name")

    async with rls_bypass(db):
        clash = (
            await db.execute(
                select(Organisation).where(
                    Organisation.zolexora_org_id == zx_org_id,
                    Organisation.id != user.organisation_id,
                )
            )
        ).scalars().first()
        if clash:
            raise HTTPException(status_code=409, detail="That Zolexora business is already linked to another TMS workspace.")
        org = (
            await db.execute(select(Organisation).where(Organisation.id == user.organisation_id))
        ).scalars().first()
        if not org:
            raise HTTPException(status_code=404, detail="Organisation not found.")
        org.zolexora_org_id = zx_org_id
        if org_name:
            org.name = org_name[:160]
    await db.commit()
    await db.refresh(org)
    return OrganisationResponse.model_validate(org)


@router.get("/organisations/me", response_model=OrganisationResponse)
async def get_my_organisation(
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_organisation_by_id(
        org_id=user.organisation_id,
        user_id=user.id,
        db=db,
    )


@router.get("/organisations/members", response_model=list[MemberResponse])
async def get_members(
    user: AuthenticatedUser = Depends(require_permission("users.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await list_organisation_members(org_id=user.organisation_id, db=db)


@router.post("/organisations/members/invite")
async def invite_new_member(
    req: MemberInviteRequest,
    user: AuthenticatedUser = Depends(require_permission("users.manage")),
    db: AsyncSession = Depends(get_db),
):
    return await invite_member(
        org_id=user.organisation_id,
        actor_id=user.id,
        req=req,
        db=db,
    )

@router.post("/organisations/commander/transfer")
async def transfer_commander_route(
    req: CommanderTransferRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.is_commander:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the Commander can transfer Commander authority."
        )
    return await transfer_commander(
        org_id=user.organisation_id,
        current_commander_id=user.id,
        req=req,
        db=db,
    )

@router.delete("/organisations/members/{user_id}")
async def remove_member(
    user_id: str,
    user: AuthenticatedUser = Depends(require_permission("users.manage")),
    db: AsyncSession = Depends(get_db),
):
    from fastapi import HTTPException
    import uuid
    target_id = uuid.UUID(user_id)
    
    # Self-protection logic
    if target_id == user.id and user.is_commander:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Commander cannot remove their own membership. Transfer Commander authority first."
        )
        
    # In a full implementation, we'd delete or suspend the user here.
    # For now we'll just throw 501 Not Implemented because the rest of it belongs to later phases.
    raise HTTPException(status_code=501, detail="Member removal is planned for a later phase.")
