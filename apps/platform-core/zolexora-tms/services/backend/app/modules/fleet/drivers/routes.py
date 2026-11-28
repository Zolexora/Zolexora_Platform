import uuid
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_organisation, CurrentUserContext
from app.db.session import get_db
from app.modules.fleet.drivers.models import Driver, DriverStatus, DriverType
from app.modules.fleet.drivers.schemas import (
    DriverBulkCreateRequest,
    DriverBulkCreateResponse,
    DriverCreate,
    DriverResponse,
    DriverUpdate,
)
from app.modules.fleet.drivers import service

router = APIRouter(prefix="/api/v1/drivers", tags=["Drivers"])


async def find_driver_for_caller(
    db: AsyncSession,
    org_id: uuid.UUID,
    email: Optional[str],
    phone_number: Optional[str],
) -> Optional[Driver]:
    """Resolves the Driver record linked to a signed-in caller's email or verified phone."""
    if email:
        driver = (
            await db.execute(
                select(Driver)
                .where(
                    Driver.organisation_id == org_id,
                    func.lower(Driver.email) == email.lower(),
                )
                .limit(1)
            )
        ).scalar_one_or_none()
        if driver:
            return driver
    if phone_number:
        return (
            await db.execute(
                select(Driver)
                .where(
                    Driver.organisation_id == org_id,
                    Driver.phone == phone_number,
                )
                .limit(1)
            )
        ).scalar_one_or_none()
    return None


@router.post("", response_model=DriverResponse, status_code=status.HTTP_201_CREATED)
async def create_driver(
    req: DriverCreate,
    ctx: CurrentUserContext = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db),
):
    return await service.create_driver(
        org_id=ctx.organisation_id,
        actor_id=ctx.user_id,
        req=req,
        db=db,
    )


@router.post("/bulk", response_model=DriverBulkCreateResponse, status_code=status.HTTP_201_CREATED)
async def bulk_create_drivers(
    req: DriverBulkCreateRequest,
    ctx: CurrentUserContext = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db),
):
    return await service.bulk_create_drivers(
        org_id=ctx.organisation_id,
        actor_id=ctx.user_id,
        items=req.drivers,
        db=db,
    )


@router.get("", response_model=list[DriverResponse])
async def list_drivers(
    status: Optional[DriverStatus] = None,
    driver_type: Optional[DriverType] = None,
    search: Optional[str] = Query(None, min_length=1, max_length=100),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    ctx: CurrentUserContext = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_drivers(
        org_id=ctx.organisation_id,
        db=db,
        status_filter=status,
        driver_type=driver_type,
        search=search,
        skip=skip,
        limit=limit,
    )


@router.get("/me", response_model=DriverResponse)
async def get_my_driver(
    ctx: CurrentUserContext = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db),
):
    """The driver record of the signed-in employee (matched on email or verified phone)."""
    if not ctx.email and not ctx.phone_number:
        raise HTTPException(status_code=404, detail="Your account has no email or phone to match a driver record")
    driver = await find_driver_for_caller(db, ctx.organisation_id, ctx.email, ctx.phone_number)
    if not driver:
        raise HTTPException(status_code=404, detail="No driver record in this organisation matches your account")
    return driver


@router.get("/{driver_id}", response_model=DriverResponse)
async def get_driver(
    driver_id: uuid.UUID,
    ctx: CurrentUserContext = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_driver(
        org_id=ctx.organisation_id,
        driver_id=driver_id,
        db=db,
    )


@router.patch("/{driver_id}", response_model=DriverResponse)
async def update_driver(
    driver_id: uuid.UUID,
    req: DriverUpdate,
    ctx: CurrentUserContext = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db),
):
    return await service.update_driver(
        org_id=ctx.organisation_id,
        driver_id=driver_id,
        actor_id=ctx.user_id,
        req=req,
        db=db,
    )


@router.delete("/{driver_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_driver(
    driver_id: uuid.UUID,
    ctx: CurrentUserContext = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db),
):
    await service.delete_driver(
        org_id=ctx.organisation_id,
        driver_id=driver_id,
        actor_id=ctx.user_id,
        db=db,
    )


@router.post("/{driver_id}/avatar")
async def upload_avatar(
    driver_id: uuid.UUID,
    file: UploadFile = File(...),
    ctx: CurrentUserContext = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    url = await service.upload_driver_avatar(
        org_id=ctx.organisation_id,
        driver_id=driver_id,
        file_bytes=content,
        db=db,
    )
    return {"avatar_url": url}


@router.post("/{driver_id}/documents")
async def upload_document(
    driver_id: uuid.UUID,
    doc_type: str = Form(..., description="e.g. license, aadhaar, police_verification"),
    file: UploadFile = File(...),
    ctx: CurrentUserContext = Depends(get_current_active_organisation),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    url = await service.upload_driver_doc(
        org_id=ctx.organisation_id,
        driver_id=driver_id,
        doc_type=doc_type,
        file_name=file.filename or "document.pdf",
        file_bytes=content,
        content_type=file.content_type or "application/pdf",
        db=db,
    )
    return {"doc_type": doc_type, "document_url": url}
