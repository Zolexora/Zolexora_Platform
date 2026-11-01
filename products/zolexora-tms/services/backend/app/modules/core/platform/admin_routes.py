import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.db.session import get_db
from app.auth.dependencies import AuthenticatedIdentity, require_platform_admin
from app.modules.identity.organisations.models import Organisation, OrganisationStatus
from app.modules.identity.organisations.membership_models import OrganisationMember
from app.modules.core.platform.models import PlatformAuditLog, TenantQuota

router = APIRouter(prefix="/api/v1/admin", tags=["Platform Admin Management"])


class AdminMeResponse(BaseModel):
    user_id: str
    email: Optional[str] = None
    role: str = "PLATFORM_ADMIN"


class QuotaSchema(BaseModel):
    tier: str = "STANDARD"
    max_members: int = 50
    max_vehicles: int = 100
    max_duties_per_month: int = 1000


class QuotaUpdateRequest(BaseModel):
    tier: Optional[str] = None
    max_members: Optional[int] = None
    max_vehicles: Optional[int] = None
    max_duties_per_month: Optional[int] = None


class MemberItem(BaseModel):
    id: str
    organisation_id: str
    user_id: str
    status: str
    is_creator: bool
    is_commander: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminOrganisationResponse(BaseModel):
    id: str
    name: str
    organisation_type: str
    status: str
    created_at: datetime
    updated_at: datetime
    member_count: int = 0
    quota: Optional[QuotaSchema] = None
    members: Optional[List[MemberItem]] = None


class PlatformStatsResponse(BaseModel):
    total_tenants: int
    active_tenants: int
    suspended_tenants: int
    total_members: int


@router.get("/me", response_model=AdminMeResponse)
async def get_admin_me(
    admin: AuthenticatedIdentity = Depends(require_platform_admin),
):
    return AdminMeResponse(
        user_id=str(admin.id),
        email=admin.email,
        role="PLATFORM_ADMIN",
    )


@router.get("/stats", response_model=PlatformStatsResponse)
async def get_platform_stats(
    db: AsyncSession = Depends(get_db),
    admin: AuthenticatedIdentity = Depends(require_platform_admin),
):
    total_res = await db.execute(select(func.count(Organisation.id)))
    total_tenants = total_res.scalar() or 0

    active_res = await db.execute(select(func.count(Organisation.id)).where(Organisation.status == OrganisationStatus.ACTIVE))
    active_tenants = active_res.scalar() or 0

    suspended_res = await db.execute(select(func.count(Organisation.id)).where(Organisation.status == OrganisationStatus.SUSPENDED))
    suspended_tenants = suspended_res.scalar() or 0

    members_res = await db.execute(select(func.count(OrganisationMember.id)))
    total_members = members_res.scalar() or 0

    return PlatformStatsResponse(
        total_tenants=total_tenants,
        active_tenants=active_tenants,
        suspended_tenants=suspended_tenants,
        total_members=total_members,
    )


@router.get("/organisations", response_model=List[AdminOrganisationResponse])
async def list_admin_organisations(
    include_members: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    admin: AuthenticatedIdentity = Depends(require_platform_admin),
):
    orgs_query = await db.execute(select(Organisation).order_by(desc(Organisation.created_at)))
    organisations = orgs_query.scalars().all()

    # Pre-fetch member counts
    counts_query = await db.execute(
        select(OrganisationMember.organisation_id, func.count(OrganisationMember.id))
        .group_by(OrganisationMember.organisation_id)
    )
    counts_map = dict(counts_query.all())

    # Pre-fetch quotas
    quotas_query = await db.execute(select(TenantQuota))
    quotas_map = {q.organisation_id: q for q in quotas_query.scalars().all()}

    # Pre-fetch members if requested
    members_map = {}
    if include_members:
        members_query = await db.execute(select(OrganisationMember).order_by(desc(OrganisationMember.created_at)))
        for m in members_query.scalars().all():
            members_map.setdefault(m.organisation_id, []).append(
                MemberItem(
                    id=str(m.id),
                    organisation_id=str(m.organisation_id),
                    user_id=str(m.user_id),
                    status=m.status.value if hasattr(m.status, "value") else str(m.status),
                    is_creator=m.is_creator,
                    is_commander=m.is_commander,
                    created_at=m.created_at,
                )
            )

    response = []
    for org in organisations:
        quota_obj = quotas_map.get(org.id)
        quota_data = (
            QuotaSchema(
                tier=quota_obj.tier,
                max_members=quota_obj.max_members,
                max_vehicles=quota_obj.max_vehicles,
                max_duties_per_month=quota_obj.max_duties_per_month,
            )
            if quota_obj
            else QuotaSchema()
        )

        response.append(
            AdminOrganisationResponse(
                id=str(org.id),
                name=org.name,
                organisation_type=org.organisation_type,
                status=org.status.value if hasattr(org.status, "value") else str(org.status),
                created_at=org.created_at,
                updated_at=org.updated_at,
                member_count=counts_map.get(org.id, 0),
                quota=quota_data,
                members=members_map.get(org.id) if include_members else None,
            )
        )

    return response


@router.post("/organisations/{organisation_id}/suspend")
async def suspend_organisation(
    organisation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: AuthenticatedIdentity = Depends(require_platform_admin),
):
    query = await db.execute(select(Organisation).where(Organisation.id == organisation_id))
    org = query.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    org.status = OrganisationStatus.SUSPENDED

    audit = PlatformAuditLog(
        user_id=admin.id,
        organisation_id=org.id,
        event_type="ORGANISATION_SUSPENDED",
        entity_type="organisations",
        entity_id=str(org.id),
        payload=f"Suspended organisation '{org.name}' ({org.id})",
    )
    db.add(audit)
    await db.commit()

    return {"message": f"Organisation '{org.name}' has been suspended successfully."}


@router.post("/organisations/{organisation_id}/activate")
async def activate_organisation(
    organisation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: AuthenticatedIdentity = Depends(require_platform_admin),
):
    query = await db.execute(select(Organisation).where(Organisation.id == organisation_id))
    org = query.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    org.status = OrganisationStatus.ACTIVE

    audit = PlatformAuditLog(
        user_id=admin.id,
        organisation_id=org.id,
        event_type="ORGANISATION_ACTIVATED",
        entity_type="organisations",
        entity_id=str(org.id),
        payload=f"Activated organisation '{org.name}' ({org.id})",
    )
    db.add(audit)
    await db.commit()

    return {"message": f"Organisation '{org.name}' has been activated successfully."}


@router.get("/organisations/{organisation_id}/quota", response_model=QuotaSchema)
async def get_organisation_quota(
    organisation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: AuthenticatedIdentity = Depends(require_platform_admin),
):
    query = await db.execute(select(TenantQuota).where(TenantQuota.organisation_id == organisation_id))
    quota = query.scalar_one_or_none()
    if not quota:
        return QuotaSchema()

    return QuotaSchema(
        tier=quota.tier,
        max_members=quota.max_members,
        max_vehicles=quota.max_vehicles,
        max_duties_per_month=quota.max_duties_per_month,
    )


@router.put("/organisations/{organisation_id}/quota", response_model=QuotaSchema)
async def update_organisation_quota(
    organisation_id: uuid.UUID,
    req: QuotaUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: AuthenticatedIdentity = Depends(require_platform_admin),
):
    org_query = await db.execute(select(Organisation).where(Organisation.id == organisation_id))
    org = org_query.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    query = await db.execute(select(TenantQuota).where(TenantQuota.organisation_id == organisation_id))
    quota = query.scalar_one_or_none()

    if not quota:
        quota = TenantQuota(
            organisation_id=organisation_id,
            tier=req.tier or "STANDARD",
            max_members=req.max_members or 50,
            max_vehicles=req.max_vehicles or 100,
            max_duties_per_month=req.max_duties_per_month or 1000,
        )
        db.add(quota)
    else:
        if req.tier is not None:
            quota.tier = req.tier
        if req.max_members is not None:
            quota.max_members = req.max_members
        if req.max_vehicles is not None:
            quota.max_vehicles = req.max_vehicles
        if req.max_duties_per_month is not None:
            quota.max_duties_per_month = req.max_duties_per_month

    audit = PlatformAuditLog(
        user_id=admin.id,
        organisation_id=organisation_id,
        event_type="ORGANISATION_QUOTA_UPDATED",
        entity_type="tenant_quotas",
        entity_id=str(organisation_id),
        payload=f"Updated quota for org {organisation_id}: tier={quota.tier}, max_members={quota.max_members}, max_vehicles={quota.max_vehicles}",
    )
    db.add(audit)
    await db.commit()
    await db.refresh(quota)

    return QuotaSchema(
        tier=quota.tier,
        max_members=quota.max_members,
        max_vehicles=quota.max_vehicles,
        max_duties_per_month=quota.max_duties_per_month,
    )
