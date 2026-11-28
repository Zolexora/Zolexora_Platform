import uuid
from typing import Any, Optional
from fastapi import HTTPException, status
from pydantic import ValidationError
from sqlalchemy import desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.storage import upload_image_to_cloudinary, upload_document_to_r2
from app.modules.core.audit.models import AuditLog
from app.modules.crm.vendors.models import Vendor
from app.modules.fleet.drivers.models import Driver, DriverStatus, DriverType
from app.modules.fleet.drivers.schemas import (
    DriverBulkCreateResponse,
    DriverBulkItemError,
    DriverCreate,
    DriverResponse,
    DriverUpdate,
)


def _generate_driver_code() -> str:
    return f"DRV-{uuid.uuid4().hex[:8].upper()}"


async def _hydrate_drivers(drivers: list[Driver], db: AsyncSession) -> list[DriverResponse]:
    vendor_ids = {d.vendor_id for d in drivers if d.vendor_id}
    vendor_map: dict[uuid.UUID, Vendor] = {}
    if vendor_ids:
        res = await db.execute(select(Vendor).where(Vendor.id.in_(vendor_ids)))
        vendor_map = {v.id: v for v in res.scalars().all()}

    out: list[DriverResponse] = []
    for d in drivers:
        resp = DriverResponse.model_validate(d)
        if d.vendor_id and d.vendor_id in vendor_map:
            vnd = vendor_map[d.vendor_id]
            resp.vendor_code = vnd.vendor_code
            resp.vendor_name = vnd.name
            resp.vendor_pan = vnd.pan
        out.append(resp)
    return out


async def _resolve_vendor_id(
    org_id: uuid.UUID,
    vendor_id: Optional[uuid.UUID],
    vendor_code: Optional[str],
    db: AsyncSession,
) -> Optional[uuid.UUID]:
    if vendor_id:
        return vendor_id
    if vendor_code and vendor_code.strip():
        code = vendor_code.strip().upper()
        vnd = (
            await db.execute(
                select(Vendor.id).where(
                    Vendor.organisation_id == org_id,
                    Vendor.vendor_code == code,
                )
            )
        ).scalar_one_or_none()
        if not vnd:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Vendor code '{code}' not found in your organisation",
            )
        return vnd
    return None


async def _ensure_unique_driver_fields(
    org_id: uuid.UUID,
    phone: Optional[str],
    license_number: Optional[str],
    pan: Optional[str],
    db: AsyncSession,
    exclude_driver_id: Optional[uuid.UUID] = None,
) -> None:
    if phone:
        stmt = select(Driver.id).where(Driver.organisation_id == org_id, Driver.phone == phone)
        if exclude_driver_id is not None:
            stmt = stmt.where(Driver.id != exclude_driver_id)
        if (await db.execute(stmt.limit(1))).scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Driver with phone '{phone}' already exists",
            )
    if license_number:
        stmt = select(Driver.id).where(Driver.organisation_id == org_id, Driver.license_number == license_number)
        if exclude_driver_id is not None:
            stmt = stmt.where(Driver.id != exclude_driver_id)
        if (await db.execute(stmt.limit(1))).scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Driver with license number '{license_number}' already exists",
            )
    if pan:
        stmt = select(Driver.id).where(Driver.organisation_id == org_id, Driver.pan == pan)
        if exclude_driver_id is not None:
            stmt = stmt.where(Driver.id != exclude_driver_id)
        if (await db.execute(stmt.limit(1))).scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Driver with PAN '{pan}' already exists",
            )


async def create_driver(
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    req: DriverCreate,
    db: AsyncSession,
) -> DriverResponse:
    phone_clean = req.phone.strip()
    lic_clean = req.license_number.strip().upper().replace(" ", "")
    pan_clean = req.pan.strip().upper() if req.pan else None

    await _ensure_unique_driver_fields(org_id, phone_clean, lic_clean, pan_clean, db)
    resolved_vendor_id = await _resolve_vendor_id(org_id, req.vendor_id, req.vendor_code, db)

    driver = Driver(
        id=uuid.uuid4(),
        organisation_id=org_id,
        vendor_id=resolved_vendor_id,
        driver_code=_generate_driver_code(),
        full_name=req.full_name.strip(),
        phone=phone_clean,
        alternate_phone=req.alternate_phone.strip() if req.alternate_phone else None,
        email=req.email.strip() if req.email else None,
        license_number=lic_clean,
        license_type=req.license_type.strip().upper(),
        license_expiry=req.license_expiry,
        badge_number=req.badge_number.strip().upper() if req.badge_number else None,
        aadhaar_last4=req.aadhaar_last4,
        pan=pan_clean,
        driver_type=req.driver_type,
        status=DriverStatus.AVAILABLE,
        avatar_url=req.avatar_url,
        documents=req.documents,
    )
    db.add(driver)

    audit = AuditLog(
        id=uuid.uuid4(),
        organisation_id=org_id,
        actor_user_id=actor_id,
        action="DRIVER_CREATED",
        entity_type="driver",
        entity_id=driver.id,
        metadata_={"driver_name": driver.full_name, "license": driver.license_number},
    )
    db.add(audit)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Driver phone, license number, or PAN already exists",
        )
    await db.refresh(driver)
    return (await _hydrate_drivers([driver], db))[0]


async def bulk_create_drivers(
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    items: list[dict[str, Any]],
    db: AsyncSession,
) -> DriverBulkCreateResponse:
    created_drivers: list[Driver] = []
    errors: list[DriverBulkItemError] = []
    parsed_rows: list[tuple[int, DriverCreate]] = []

    for idx, raw in enumerate(items, start=1):
        cleaned = {
            k: (v.strip() if isinstance(v, str) else v)
            for k, v in raw.items()
            if not (isinstance(v, str) and v.strip() == "")
        }
        try:
            req = DriverCreate.model_validate(cleaned)
        except ValidationError as exc:
            msg = "; ".join(f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors())
            errors.append(
                DriverBulkItemError(
                    row=idx,
                    full_name=str(cleaned.get("full_name")) if cleaned.get("full_name") else None,
                    error=msg,
                )
            )
            continue
        parsed_rows.append((idx, req))

    existing_phones = set(
        (await db.execute(select(Driver.phone).where(Driver.organisation_id == org_id))).scalars().all()
    )
    existing_licenses = set(
        (await db.execute(select(Driver.license_number).where(Driver.organisation_id == org_id))).scalars().all()
    )
    existing_pans = {
        p
        for p in (
            await db.execute(select(Driver.pan).where(Driver.organisation_id == org_id, Driver.pan.is_not(None)))
        )
        .scalars()
        .all()
        if p
    }
    vendor_res = await db.execute(
        select(Vendor.vendor_code, Vendor.id).where(
            Vendor.organisation_id == org_id,
            Vendor.vendor_code.is_not(None),
        )
    )
    vendor_by_code = {code.upper(): vid for code, vid in vendor_res.all() if code}

    seen_phones: set[str] = set()
    seen_licenses: set[str] = set()
    seen_pans: set[str] = set()

    for idx, req in parsed_rows:
        phone_clean = req.phone.strip()
        lic_clean = req.license_number.strip().upper().replace(" ", "")
        pan_clean = req.pan.strip().upper() if req.pan else None

        if phone_clean in existing_phones or phone_clean in seen_phones:
            errors.append(DriverBulkItemError(row=idx, full_name=req.full_name, error=f"Duplicate phone '{phone_clean}'"))
            continue
        if lic_clean in existing_licenses or lic_clean in seen_licenses:
            errors.append(DriverBulkItemError(row=idx, full_name=req.full_name, error=f"Duplicate license '{lic_clean}'"))
            continue
        if pan_clean and (pan_clean in existing_pans or pan_clean in seen_pans):
            errors.append(DriverBulkItemError(row=idx, full_name=req.full_name, error=f"Duplicate PAN '{pan_clean}'"))
            continue

        vendor_id = req.vendor_id
        if not vendor_id and req.vendor_code and req.vendor_code.strip():
            code_clean = req.vendor_code.strip().upper()
            vendor_id = vendor_by_code.get(code_clean)
            if not vendor_id:
                errors.append(
                    DriverBulkItemError(row=idx, full_name=req.full_name, error=f"Vendor code '{code_clean}' not found")
                )
                continue

        seen_phones.add(phone_clean)
        seen_licenses.add(lic_clean)
        if pan_clean:
            seen_pans.add(pan_clean)

        driver = Driver(
            id=uuid.uuid4(),
            organisation_id=org_id,
            vendor_id=vendor_id,
            driver_code=_generate_driver_code(),
            full_name=req.full_name.strip(),
            phone=phone_clean,
            alternate_phone=req.alternate_phone.strip() if req.alternate_phone else None,
            email=req.email.strip() if req.email else None,
            license_number=lic_clean,
            license_type=req.license_type.strip().upper(),
            license_expiry=req.license_expiry,
            badge_number=req.badge_number.strip().upper() if req.badge_number else None,
            aadhaar_last4=req.aadhaar_last4,
            pan=pan_clean,
            driver_type=req.driver_type,
            status=DriverStatus.AVAILABLE,
            avatar_url=req.avatar_url,
            documents=req.documents,
        )
        db.add(driver)
        created_drivers.append(driver)

    if created_drivers:
        db.add(
            AuditLog(
                id=uuid.uuid4(),
                organisation_id=org_id,
                actor_user_id=actor_id,
                action="DRIVER_BULK_CREATED",
                entity_type="driver",
                entity_id=None,
                metadata_={"created_count": len(created_drivers)},
            )
        )
        await db.commit()
        for d in created_drivers:
            await db.refresh(d)

    errors.sort(key=lambda e: e.row)
    hydrated = await _hydrate_drivers(created_drivers, db) if created_drivers else []
    return DriverBulkCreateResponse(
        created_count=len(created_drivers),
        failed_count=len(errors),
        created=hydrated,
        errors=errors,
    )


async def list_drivers(
    org_id: uuid.UUID,
    db: AsyncSession,
    status_filter: Optional[DriverStatus] = None,
    driver_type: Optional[DriverType] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> list[DriverResponse]:
    stmt = select(Driver).where(Driver.organisation_id == org_id)

    if status_filter:
        stmt = stmt.where(Driver.status == status_filter)

    if driver_type:
        stmt = stmt.where(Driver.driver_type == driver_type)

    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            Driver.full_name.ilike(pattern)
            | Driver.driver_code.ilike(pattern)
            | Driver.phone.ilike(pattern)
            | Driver.license_number.ilike(pattern)
            | Driver.pan.ilike(pattern)
        )

    stmt = stmt.order_by(desc(Driver.created_at)).offset(skip).limit(limit)
    res = await db.execute(stmt)
    rows = list(res.scalars().all())
    return await _hydrate_drivers(rows, db)


async def get_driver(
    org_id: uuid.UUID,
    driver_id: uuid.UUID,
    db: AsyncSession,
) -> DriverResponse:
    stmt = select(Driver).where(
        Driver.id == driver_id,
        Driver.organisation_id == org_id,
    )
    res = await db.execute(stmt)
    driver = res.scalars().first()
    if not driver:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")
    return (await _hydrate_drivers([driver], db))[0]


async def update_driver(
    org_id: uuid.UUID,
    driver_id: uuid.UUID,
    actor_id: uuid.UUID,
    req: DriverUpdate,
    db: AsyncSession,
) -> DriverResponse:
    stmt = select(Driver).where(
        Driver.id == driver_id,
        Driver.organisation_id == org_id,
    )
    res = await db.execute(stmt)
    driver = res.scalars().first()
    if not driver:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")

    update_data = req.model_dump(exclude_unset=True)
    if "vendor_code" in update_data:
        vcode = update_data.pop("vendor_code")
        if vcode and str(vcode).strip():
            driver.vendor_id = await _resolve_vendor_id(org_id, None, str(vcode), db)
        elif "vendor_id" not in update_data:
            driver.vendor_id = None

    phone_chk = update_data["phone"].strip() if update_data.get("phone") else None
    lic_chk = update_data["license_number"].strip().upper().replace(" ", "") if update_data.get("license_number") else None
    pan_chk = update_data["pan"].strip().upper() if update_data.get("pan") else None
    await _ensure_unique_driver_fields(org_id, phone_chk, lic_chk, pan_chk, db, exclude_driver_id=driver_id)

    for field, val in update_data.items():
        if val is not None and isinstance(val, str):
            val = val.strip()
            if field in ("license_number", "license_type", "badge_number", "pan"):
                val = val.upper()
            if field == "license_number":
                val = val.replace(" ", "")
        setattr(driver, field, val)

    audit = AuditLog(
        id=uuid.uuid4(),
        organisation_id=org_id,
        actor_user_id=actor_id,
        action="DRIVER_UPDATED",
        entity_type="driver",
        entity_id=driver.id,
        metadata_={"updated_fields": list(update_data.keys())},
    )
    db.add(audit)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Driver phone, license number, or PAN already exists",
        )
    await db.refresh(driver)
    return (await _hydrate_drivers([driver], db))[0]


async def delete_driver(
    org_id: uuid.UUID,
    driver_id: uuid.UUID,
    actor_id: uuid.UUID,
    db: AsyncSession,
) -> None:
    stmt = select(Driver).where(
        Driver.id == driver_id,
        Driver.organisation_id == org_id,
    )
    res = await db.execute(stmt)
    driver = res.scalars().first()
    if not driver:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")

    driver.status = DriverStatus.INACTIVE
    audit = AuditLog(
        id=uuid.uuid4(),
        organisation_id=org_id,
        actor_user_id=actor_id,
        action="DRIVER_DEACTIVATED",
        entity_type="driver",
        entity_id=driver.id,
        metadata_={"driver_name": driver.full_name},
    )
    db.add(audit)
    await db.commit()


async def upload_driver_avatar(
    org_id: uuid.UUID,
    driver_id: uuid.UUID,
    file_bytes: bytes,
    db: AsyncSession,
) -> str:
    stmt = select(Driver).where(Driver.id == driver_id, Driver.organisation_id == org_id)
    res = await db.execute(stmt)
    driver = res.scalars().first()
    if not driver:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")

    url = await upload_image_to_cloudinary(file_bytes, folder=f"zolexora/{org_id}/drivers")
    driver.avatar_url = url
    await db.commit()
    return url


async def upload_driver_doc(
    org_id: uuid.UUID,
    driver_id: uuid.UUID,
    doc_type: str,
    file_name: str,
    file_bytes: bytes,
    content_type: str,
    db: AsyncSession,
) -> str:
    stmt = select(Driver).where(Driver.id == driver_id, Driver.organisation_id == org_id)
    res = await db.execute(stmt)
    driver = res.scalars().first()
    if not driver:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")

    url = await upload_document_to_r2(
        file_bytes=file_bytes,
        file_name=file_name,
        content_type=content_type,
        folder=f"tenants/{org_id}/drivers/{driver_id}",
    )
    docs = dict(driver.documents)
    docs[doc_type] = url
    driver.documents = docs
    await db.commit()
    return url
