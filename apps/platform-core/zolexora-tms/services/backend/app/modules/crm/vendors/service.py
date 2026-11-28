import secrets
import uuid
from typing import Any, Optional
from fastapi import HTTPException, status
from pydantic import ValidationError
from sqlalchemy import desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.zolexora import reserve_or_verify_partner_id
from app.modules.core.audit.models import AuditLog
from app.modules.crm.vendors.models import Vendor, VendorStatus, VendorType
from app.modules.crm.vendors.schemas import (
    VendorBulkCreateResponse,
    VendorBulkItemError,
    VendorCreate,
    VendorResponse,
    VendorUpdate,
)


def _generate_vendor_code() -> str:
    return f"v{secrets.randbelow(100_000_000):08d}@zolexora.com"


def _normalize_partner_code(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    val = raw.strip()
    if not val:
        return None
    return val.lower() if "@" in val else val.upper()


async def _ensure_unique_gstin(
    org_id: uuid.UUID,
    gstin: Optional[str],
    db: AsyncSession,
    exclude_vendor_id: Optional[uuid.UUID] = None,
) -> None:
    if not gstin:
        return
    stmt = select(Vendor.id).where(
        Vendor.organisation_id == org_id,
        Vendor.gstin == gstin,
    )
    if exclude_vendor_id is not None:
        stmt = stmt.where(Vendor.id != exclude_vendor_id)
    existing = (await db.execute(stmt.limit(1))).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Vendor with GSTIN / Aadhaar No '{gstin}' already exists",
        )


def _build_vendor_and_audit(
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    req: VendorCreate,
) -> tuple[Vendor, AuditLog]:
    zx_handle = _normalize_partner_code(req.zolexora_org_id)
    vendor_code = zx_handle if (req.is_zolexora_user and zx_handle) else _generate_vendor_code()
    vendor = Vendor(
        id=uuid.uuid4(),
        organisation_id=org_id,
        vendor_code=vendor_code,
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
        is_zolexora_user=bool(req.is_zolexora_user),
        zolexora_org_id=zx_handle if req.is_zolexora_user else None,
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
    auth_token: Optional[str] = None,
) -> VendorResponse:
    await _ensure_unique_gstin(org_id=org_id, gstin=req.gstin, db=db)
    zx_handle = _normalize_partner_code(req.zolexora_org_id)
    reserved = await reserve_or_verify_partner_id(
        kind="vendor",
        is_zolexora_user=bool(req.is_zolexora_user),
        zolexora_id=zx_handle,
        bearer_token=auth_token,
    )
    vendor, audit = _build_vendor_and_audit(org_id=org_id, actor_id=actor_id, req=req)
    if reserved:
        vendor.vendor_code = reserved
        if req.is_zolexora_user:
            vendor.zolexora_org_id = reserved
    db.add(vendor)
    db.add(audit)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Vendor with GSTIN / Aadhaar No '{req.gstin}' already exists",
        )
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
    parsed_rows: list[tuple[int, VendorCreate]] = []

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
        parsed_rows.append((idx, req))

    candidate_gstins = {req.gstin for _, req in parsed_rows if req.gstin}
    existing_gstins: set[str] = set()
    if candidate_gstins:
        res = await db.execute(
            select(Vendor.gstin).where(
                Vendor.organisation_id == org_id,
                Vendor.gstin.in_(candidate_gstins),
            )
        )
        existing_gstins = {g for g in res.scalars().all() if g}

    seen_gstins: set[str] = set()
    for idx, req in parsed_rows:
        if req.gstin and (req.gstin in existing_gstins or req.gstin in seen_gstins):
            errors.append(
                VendorBulkItemError(
                    row=idx,
                    name=req.name,
                    error=f"Duplicate GSTIN / Aadhaar No '{req.gstin}' already exists",
                )
            )
            continue
        if req.gstin:
            seen_gstins.add(req.gstin)

        vendor, audit = _build_vendor_and_audit(org_id=org_id, actor_id=actor_id, req=req)
        db.add(vendor)
        db.add(audit)
        created_vendors.append(vendor)

    if created_vendors:
        await db.commit()
        for vendor in created_vendors:
            await db.refresh(vendor)

    errors.sort(key=lambda e: e.row)
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
        stmt = stmt.where(
            Vendor.name.ilike(pattern)
            | Vendor.phone.ilike(pattern)
            | Vendor.gstin.ilike(pattern)
            | Vendor.vendor_code.ilike(pattern)
        )

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
    if "gstin" in update_data and update_data["gstin"]:
        await _ensure_unique_gstin(
            org_id=org_id,
            gstin=update_data["gstin"],
            db=db,
            exclude_vendor_id=vendor_id,
        )
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
