import datetime
import re
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, UniqueConstraint, Uuid, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.dependencies import OrgContext, get_org_context
from app.db.base import Base


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class OrganisationService(Base):
    __tablename__ = "organisation_services"
    __table_args__ = (
        UniqueConstraint("organisation_id", "code", name="uq_org_services_org_code"),
        Index("ix_organisation_services_organisation_id", "organisation_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organisation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    service_category: Mapped[str] = mapped_column(String(16), nullable=False, default="PASSENGER")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), default=_now, onupdate=_now, nullable=False)


class ServiceCatalogCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    code: Optional[str] = Field(None, min_length=2, max_length=64)
    service_category: str = Field(default="PASSENGER", pattern="^(PASSENGER|CARGO)$")
    description: Optional[str] = None
    is_active: bool = True


class ServiceCatalogUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    service_category: Optional[str] = Field(None, pattern="^(PASSENGER|CARGO)$")
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ServiceCatalogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organisation_id: uuid.UUID
    name: str
    code: str
    service_category: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime


def _slug_code(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]+", "_", name.strip()).strip("_").upper()
    return (cleaned or f"SVC_{uuid.uuid4().hex[:6].upper()}")[:64]


router = APIRouter(prefix="/api/v1/services", tags=["Our Services"])


@router.get("", response_model=list[ServiceCatalogResponse])
async def list_services(
    active_only: bool = Query(False),
    service_category: Optional[str] = Query(None),
    ctx: OrgContext = Depends(get_org_context),
):
    stmt = select(OrganisationService).where(
        OrganisationService.organisation_id == ctx.organisation_id
    )
    if active_only:
        stmt = stmt.where(OrganisationService.is_active == True)  # noqa: E712
    if service_category:
        stmt = stmt.where(OrganisationService.service_category == service_category.upper())
    stmt = stmt.order_by(OrganisationService.name.asc())
    rows = (await ctx.db.execute(stmt)).scalars().all()
    return [ServiceCatalogResponse.model_validate(r) for r in rows]


async def _ensure_unique_name(
    ctx: OrgContext,
    name: str,
    exclude_id: Optional[uuid.UUID] = None,
) -> None:
    stmt = select(OrganisationService.id).where(
        OrganisationService.organisation_id == ctx.organisation_id,
        func.lower(func.trim(OrganisationService.name)) == name.strip().lower(),
    )
    if exclude_id is not None:
        stmt = stmt.where(OrganisationService.id != exclude_id)
    if (await ctx.db.execute(stmt)).scalar():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Service '{name.strip()}' already exists.",
        )


@router.post("", response_model=ServiceCatalogResponse, status_code=status.HTTP_201_CREATED)
async def create_service(
    req: ServiceCatalogCreate,
    ctx: OrgContext = Depends(get_org_context),
):
    clean_name = req.name.strip()
    await _ensure_unique_name(ctx, clean_name)
    code = _slug_code(req.code) if req.code else _slug_code(clean_name)
    svc = OrganisationService(
        organisation_id=ctx.organisation_id,
        name=clean_name,
        code=code,
        service_category=req.service_category.upper(),
        description=req.description.strip() if req.description else None,
        is_active=req.is_active,
    )
    ctx.db.add(svc)
    try:
        await ctx.db.commit()
    except IntegrityError:
        await ctx.db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Service '{clean_name}' or code '{code}' already exists.",
        )
    await ctx.db.refresh(svc)
    return ServiceCatalogResponse.model_validate(svc)


@router.patch("/{service_id}", response_model=ServiceCatalogResponse)
async def update_service(
    service_id: uuid.UUID,
    req: ServiceCatalogUpdate,
    ctx: OrgContext = Depends(get_org_context),
):
    svc = (
        await ctx.db.execute(
            select(OrganisationService).where(
                OrganisationService.id == service_id,
                OrganisationService.organisation_id == ctx.organisation_id,
            )
        )
    ).scalars().first()
    if not svc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    if req.name is not None:
        clean_name = req.name.strip()
        await _ensure_unique_name(ctx, clean_name, exclude_id=svc.id)
        svc.name = clean_name
    if req.service_category is not None:
        svc.service_category = req.service_category.upper()
    if req.description is not None:
        svc.description = req.description.strip() or None
    if req.is_active is not None:
        svc.is_active = req.is_active
    try:
        await ctx.db.commit()
    except IntegrityError:
        await ctx.db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A service with this name already exists.",
        )
    await ctx.db.refresh(svc)
    return ServiceCatalogResponse.model_validate(svc)


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    service_id: uuid.UUID,
    ctx: OrgContext = Depends(get_org_context),
):
    svc = (
        await ctx.db.execute(
            select(OrganisationService).where(
                OrganisationService.id == service_id,
                OrganisationService.organisation_id == ctx.organisation_id,
            )
        )
    ).scalars().first()
    if not svc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    await ctx.db.delete(svc)
    await ctx.db.commit()
