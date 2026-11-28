import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_organisation, CurrentUserContext
from app.db.session import get_db
from app.modules.crm.vendors.models import Vendor, VendorStatus, VendorType
from app.modules.crm.vendors.schemas import (
    VendorBulkCreateRequest,
    VendorBulkCreateResponse,
    VendorCreate,
    VendorResponse,
    VendorUpdate,
)
from app.modules.crm.vendors import service

router = APIRouter(prefix="/api/v1/vendors", tags=["Vendors"])


async def find_vendor_for_caller(
    db: AsyncSession,
    org_id: uuid.UUID,
    email: Optional[str],
    phone_number: Optional[str],
) -> Optional[Vendor]:
    """Resolves the Vendor record linked to a signed-in caller's email or verified phone."""
    if email:
        vendor = (
            await db.execute(
                select(Vendor)
                .where(
                    Vendor.organisation_id == org_id,
                    func.lower(Vendor.email) == email.lower(),
                )
                .limit(1)
            )
        ).scalar_one_or_none()
        if vendor:
            return vendor
    if phone_number:
        return (
            await db.execute(
                select(Vendor)
                .where(
                    Vendor.organisation_id == org_id,
                    Vendor.phone == phone_number,
                )
                .limit(1)
            )
        ).scalar_one_or_none()
    return None


@router.post("", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
async def create_vendor(
    req: VendorCreate,
    ctx: CurrentUserContext = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db),
):
    return await service.create_vendor(
        org_id=ctx.organisation_id,
        actor_id=ctx.user_id,
        req=req,
        db=db,
    )


@router.post("/bulk", response_model=VendorBulkCreateResponse, status_code=status.HTTP_201_CREATED)
async def bulk_create_vendors(
    req: VendorBulkCreateRequest,
    ctx: CurrentUserContext = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db),
):
    return await service.bulk_create_vendors(
        org_id=ctx.organisation_id,
        actor_id=ctx.user_id,
        items=req.vendors,
        db=db,
    )


@router.get("", response_model=list[VendorResponse])
async def list_vendors(
    vendor_type: Optional[VendorType] = None,
    status: Optional[VendorStatus] = None,
    search: Optional[str] = Query(None, min_length=1, max_length=100),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    ctx: CurrentUserContext = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_vendors(
        org_id=ctx.organisation_id,
        db=db,
        vendor_type=vendor_type,
        status_filter=status,
        search=search,
        skip=skip,
        limit=limit,
    )


@router.get("/me", response_model=VendorResponse)
async def get_my_vendor(
    ctx: CurrentUserContext = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db),
):
    """The vendor record linked to the signed-in caller (matched on email or phone)."""
    if not ctx.email and not ctx.phone_number:
        raise HTTPException(status_code=404, detail="Your account has no email or phone to match a vendor record")
    vendor = await find_vendor_for_caller(db, ctx.organisation_id, ctx.email, ctx.phone_number)
    if not vendor:
        raise HTTPException(status_code=404, detail="No vendor record in this organisation matches your account")
    return vendor


@router.get("/{vendor_id}", response_model=VendorResponse)
async def get_vendor(
    vendor_id: uuid.UUID,
    ctx: CurrentUserContext = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_vendor(
        org_id=ctx.organisation_id,
        vendor_id=vendor_id,
        db=db,
    )


@router.patch("/{vendor_id}", response_model=VendorResponse)
async def update_vendor(
    vendor_id: uuid.UUID,
    req: VendorUpdate,
    ctx: CurrentUserContext = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db),
):
    return await service.update_vendor(
        org_id=ctx.organisation_id,
        vendor_id=vendor_id,
        actor_id=ctx.user_id,
        req=req,
        db=db,
    )


@router.delete("/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vendor(
    vendor_id: uuid.UUID,
    ctx: CurrentUserContext = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db),
):
    await service.delete_vendor(
        org_id=ctx.organisation_id,
        vendor_id=vendor_id,
        actor_id=ctx.user_id,
        db=db,
    )
