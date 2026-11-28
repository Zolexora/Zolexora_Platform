import uuid
from typing import Any, Optional
from fastapi import HTTPException, status
from pydantic import ValidationError
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.core.audit.models import AuditLog
from app.modules.crm.vendors.models import Vendor, VendorStatus, VendorType
from app.modules.crm.vendors.schemas import (
    VendorBulkCreateResponse,
    VendorBulkItemError,
    VendorCreate,
    VendorResponse,
    VendorUpdate,
)


def _build_vendor_and_audit(
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    req: VendorCreate,
) -> tuple[Vendor, AuditLog]:
    vendor = Vendor(
        id=uuid.uuid4(),
        organisation_id=org_id,
        name=req.name.strip(),
        vendor_type=req.vendor_type,
        contact_person=req.contact_person.strip() if req.contact_person else None,
        email=req.email.strip() if req.email else None,
        phone=req.phone.strip() if req.phone else None,
        address=req.address.strip() if req.address else None,
        gstin=req.gstin.strip().upper() if req.gstin else None,
        pan=req.pan.strip().upper() if req.pan else None,
        bank_account_name=req.bank_account_name.strip() if req.bank_account_name else None,
        bank_account_number=req.bank_account_number.strip() if req.bank_account_number else None,
        bank_ifsc=req.bank_ifsc.strip().upper() if req.bank_ifsc else None,
        bank_name=req.bank_name.strip() if req.bank_name else None,
        status=VendorStatus.ACTIVE,
    )
    audit = AuditLog(
        id=uuid.uuid4(),
        organisation_id=org_id,
        actor_user_id=actor_id,
        action="VENDOR_CREATED",
        entity_type="vendor",
        entity_id=vendor.id,
        metadata_={"vendor_name": vendor.name, "vendor_type": vendor.vendor_type.value},
    )
    return vendor, audit


async def create_vendor(
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    req: VendorCreate,
    db: AsyncSession,
) -> VendorResponse:
    vendor, audit = _build_vendor_and_audit(org_id=org_id, actor_id=actor_id, req=req)
    db.add(vendor)
    db.add(audit)

    await db.commit()
    await db.refresh(vendor)
    return VendorResponse.model_validate(vendor)


async def bulk_create_vendors(
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    items: list[dict[str, Any]],
    db: AsyncSession,
) -> VendorBulkCreateResponse:
    created_vendors: list[Vendor] = []
    errors: list[VendorBulkItemError] = []

    for idx, raw in enumerate(items, start=1):
        cleaned = {
            k: (v.strip() if isinstance(v, str) else v)
            for k, v in raw.items()
            if not (isinstance(v, str) and v.strip() == "")
        }
        try:
            req = VendorCreate.model_validate(cleaned)
        except ValidationError as exc:
            msg = "; ".join(f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors())
            errors.append(
                VendorBulkItemError(
                    row=idx,
                    name=str(cleaned.get("name")) if cleaned.get("name") else None,
                    error=msg,
                )
            )
            continue

        vendor, audit = _build_vendor_and_audit(org_id=org_id, actor_id=actor_id, req=req)
        db.add(vendor)
        db.add(audit)
        created_vendors.append(vendor)

    if created_vendors:
        await db.commit()
        for vendor in created_vendors:
            await db.refresh(vendor)

    return VendorBulkCreateResponse(
        created_count=len(created_vendors),
        failed_count=len(errors),
        created=[VendorResponse.model_validate(v) for v in created_vendors],
        errors=errors,
    )


async def list_vendors(
    org_id: uuid.UUID,
    db: AsyncSession,
    vendor_type: Optional[VendorType] = None,
    status_filter: Optional[VendorStatus] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> list[VendorResponse]:
    stmt = select(Vendor).where(Vendor.organisation_id == org_id)

    if vendor_type:
        stmt = stmt.where(Vendor.vendor_type == vendor_type)

    if status_filter:
        stmt = stmt.where(Vendor.status == status_filter)

    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(Vendor.name.ilike(pattern) | Vendor.phone.ilike(pattern))

    stmt = stmt.order_by(desc(Vendor.created_at)).offset(skip).limit(limit)
    res = await db.execute(stmt)
    rows = res.scalars().all()
    return [VendorResponse.model_validate(r) for r in rows]


async def get_vendor(
    org_id: uuid.UUID,
    vendor_id: uuid.UUID,
    db: AsyncSession,
) -> VendorResponse:
    stmt = select(Vendor).where(
        Vendor.id == vendor_id,
        Vendor.organisation_id == org_id,
    )
    res = await db.execute(stmt)
    vendor = res.scalars().first()
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    return VendorResponse.model_validate(vendor)


async def update_vendor(
    org_id: uuid.UUID,
    vendor_id: uuid.UUID,
    actor_id: uuid.UUID,
    req: VendorUpdate,
    db: AsyncSession,
) -> VendorResponse:
    stmt = select(Vendor).where(
        Vendor.id == vendor_id,
        Vendor.organisation_id == org_id,
    )
    res = await db.execute(stmt)
    vendor = res.scalars().first()
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")

    update_data = req.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        if val is not None and isinstance(val, str):
            val = val.strip()
            if field in ("gstin", "pan", "bank_ifsc"):
                val = val.upper()
        setattr(vendor, field, val)

    audit = AuditLog(
        id=uuid.uuid4(),
        organisation_id=org_id,
        actor_user_id=actor_id,
        action="VENDOR_UPDATED",
        entity_type="vendor",
        entity_id=vendor.id,
        metadata_={"updated_fields": list(update_data.keys())},
    )
    db.add(audit)

    await db.commit()
    await db.refresh(vendor)
    return VendorResponse.model_validate(vendor)


async def delete_vendor(
    org_id: uuid.UUID,
    vendor_id: uuid.UUID,
    actor_id: uuid.UUID,
    db: AsyncSession,
) -> None:
    stmt = select(Vendor).where(
        Vendor.id == vendor_id,
        Vendor.organisation_id == org_id,
    )
    res = await db.execute(stmt)
    vendor = res.scalars().first()
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")

    vendor.status = VendorStatus.INACTIVE
    audit = AuditLog(
        id=uuid.uuid4(),
        organisation_id=org_id,
        actor_user_id=actor_id,
        action="VENDOR_DEACTIVATED",
        entity_type="vendor",
        entity_id=vendor.id,
        metadata_={"vendor_name": vendor.name},
    )
    db.add(audit)
    await db.commit()
