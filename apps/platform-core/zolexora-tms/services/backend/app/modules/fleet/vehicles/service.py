from decimal import Decimal
import uuid
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.storage import upload_document_to_r2
from app.core.tenant import TenantContext
from app.modules.core.audit.models import AuditLog
from app.modules.crm.vendors.models import Vendor
from app.modules.fleet.vehicles.enums import (
    FuelType,
    VehicleBodyType,
    VehicleOperationalStatus,
    VehicleOwnershipType,
)
from app.modules.fleet.vehicles.models import Vehicle
from app.modules.fleet.vehicles.schemas import (
    VehicleBulkCreateItem,
    VehicleBulkResult,
    VehicleCreate,
    VehicleResponse,
    VehicleUpdate,
)


async def _hydrate_vehicles(
    vehicles: list[Vehicle],
    db: AsyncSession,
) -> list[VehicleResponse]:
    vendor_ids = {v.vendor_id for v in vehicles if v.vendor_id}
    vendor_map: dict[uuid.UUID, Vendor] = {}
    if vendor_ids:
        res = await db.execute(select(Vendor).where(Vendor.id.in_(vendor_ids)))
        vendor_map = {vnd.id: vnd for vnd in res.scalars().all()}

    out: list[VehicleResponse] = []
    for v in vehicles:
        resp = VehicleResponse.model_validate(v)
        if v.vendor_id and v.vendor_id in vendor_map:
            vnd = vendor_map[v.vendor_id]
            resp.vendor_code = vnd.vendor_code
            resp.vendor_name = vnd.name
            resp.vendor_pan = vnd.pan
        out.append(resp)
    return out


async def _check_unique_fields(
    org_id: uuid.UUID,
    fastag_id: Optional[str],
    gps_device_id: Optional[str],
    db: AsyncSession,
    exclude_vehicle_id: Optional[uuid.UUID] = None,
) -> None:
    """Raise 409 if fastag_id or gps_device_id is already taken (globally non-null)."""
    if fastag_id:
        stmt = select(Vehicle.id, Vehicle.registration_number).where(
            Vehicle.fastag_id == fastag_id,
        )
        if exclude_vehicle_id:
            stmt = stmt.where(Vehicle.id != exclude_vehicle_id)
        row = (await db.execute(stmt)).first()
        if row:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"FASTag ID '{fastag_id}' is already assigned to vehicle {row.registration_number}",
            )
    if gps_device_id:
        stmt = select(Vehicle.id, Vehicle.registration_number).where(
            Vehicle.gps_device_id == gps_device_id,
        )
        if exclude_vehicle_id:
            stmt = stmt.where(Vehicle.id != exclude_vehicle_id)
        row = (await db.execute(stmt)).first()
        if row:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"GPS Device ID '{gps_device_id}' is already assigned to vehicle {row.registration_number}",
            )


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


async def create_vehicle(
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    req: VehicleCreate,
    db: AsyncSession,
    tenant_ctx: Optional[TenantContext] = None,
) -> VehicleResponse:
    reg_clean = req.registration_number.strip().upper().replace(" ", "")

    stmt = select(Vehicle).where(
        Vehicle.organisation_id == org_id,
        Vehicle.registration_number == reg_clean,
    )
    res = await db.execute(stmt)
    if res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Vehicle '{reg_clean}' is already registered in your organisation",
        )

    fastag_clean = req.fastag_id.strip().upper() if req.fastag_id else None
    gps_clean = req.gps_device_id.strip().upper() if req.gps_device_id else None
    await _check_unique_fields(org_id, fastag_clean, gps_clean, db)

    resolved_vendor_id = await _resolve_vendor_id(org_id, req.vendor_id, req.vendor_code, db)
    ownership = req.ownership_type or (VehicleOwnershipType.ATTACHED if resolved_vendor_id else VehicleOwnershipType.OWNED)
    if resolved_vendor_id and req.ownership_type == VehicleOwnershipType.OWNED:
        ownership = VehicleOwnershipType.ATTACHED

    vehicle = Vehicle(
        id=uuid.uuid4(),
        organisation_id=org_id,
        vendor_id=resolved_vendor_id,
        registration_number=reg_clean,
        vehicle_type=req.vehicle_type or VehicleBodyType.SEDAN,
        custom_vehicle_type=req.custom_vehicle_type.strip() if req.custom_vehicle_type else None,
        ownership_type=ownership,
        make=req.make.strip() if req.make else None,
        model=req.model.strip() if req.model else None,
        year=req.year,
        fuel_type=FuelType(req.fuel_type) if req.fuel_type else FuelType.DIESEL,
        payload_capacity_kg=req.payload_capacity_kg,
        volume_cft=req.volume_cft,
        odometer_km=req.odometer_km or Decimal("0.0"),
        fastag_id=fastag_clean,
        gps_device_id=gps_clean,
        rc_number=req.rc_number.strip().upper() if req.rc_number else None,
        rc_expiry=req.rc_expiry,
        fitness_expiry=req.fitness_expiry,
        permit_expiry=req.permit_expiry,
        insurance_expiry=req.insurance_expiry,
        puc_expiry=req.puc_expiry,
        status=VehicleOperationalStatus.AVAILABLE,
        documents=req.documents or {},
    )
    db.add(vehicle)

    audit = AuditLog(
        id=uuid.uuid4(),
        organisation_id=org_id,
        actor_user_id=actor_id,
        entity_type="vehicles",
        entity_id=vehicle.id,
        action="CREATE",
        metadata_={"registration_number": reg_clean, "status": "AVAILABLE"},
    )
    db.add(audit)

    await db.commit()
    await db.refresh(vehicle)
    return (await _hydrate_vehicles([vehicle], db))[0]


async def bulk_create_vehicles(
    org_id: uuid.UUID,
    actor_id: uuid.UUID,
    items: list[VehicleBulkCreateItem],
    db: AsyncSession,
    tenant_ctx: Optional[TenantContext] = None,
) -> VehicleBulkResult:
    succeeded = 0
    errors = []
    seen_in_batch = set()

    existing_regs_stmt = select(Vehicle.registration_number).where(
        Vehicle.organisation_id == org_id
    )
    res = await db.execute(existing_regs_stmt)
    existing_regs = set(res.scalars().all())

    # Pre-fetch existing FASTag and GPS IDs (globally unique)
    existing_fastags_res = await db.execute(
        select(Vehicle.fastag_id).where(Vehicle.fastag_id.is_not(None))
    )
    existing_fastags: set[str] = set(existing_fastags_res.scalars().all())

    existing_gps_res = await db.execute(
        select(Vehicle.gps_device_id).where(Vehicle.gps_device_id.is_not(None))
    )
    existing_gps: set[str] = set(existing_gps_res.scalars().all())

    seen_fastags_in_batch: set[str] = set()
    seen_gps_in_batch: set[str] = set()

    vendor_res = await db.execute(
        select(Vendor.vendor_code, Vendor.id).where(
            Vendor.organisation_id == org_id,
            Vendor.vendor_code.is_not(None),
        )
    )
    vendor_by_code = {code.upper(): vid for code, vid in vendor_res.all() if code}

    for idx, item in enumerate(items):
        row_num = idx + 1
        try:
            reg_clean = item.registration_number.strip().upper().replace(" ", "")
            if not reg_clean or len(reg_clean) < 4:
                errors.append(
                    {"row": row_num, "registration_number": reg_clean, "error": "Invalid registration number"}
                )
                continue

            if reg_clean in existing_regs or reg_clean in seen_in_batch:
                errors.append(
                    {"row": row_num, "registration_number": reg_clean, "error": "Duplicate registration number"}
                )
                continue

            vendor_id = None
            if item.vendor_code and item.vendor_code.strip():
                code_clean = item.vendor_code.strip().upper()
                vendor_id = vendor_by_code.get(code_clean)
                if not vendor_id:
                    errors.append(
                        {"row": row_num, "registration_number": reg_clean, "error": f"Vendor code '{code_clean}' not found"}
                    )
                    continue

            vtype = VehicleBodyType.SEDAN
            custom_vtype = item.custom_vehicle_type.strip()[:64] if item.custom_vehicle_type and item.custom_vehicle_type.strip() else None
            if item.vehicle_type and item.vehicle_type.strip():
                raw_type = item.vehicle_type.strip()
                try:
                    vtype = VehicleBodyType(raw_type.upper().replace(" ", "_"))
                except ValueError:
                    vtype = VehicleBodyType.OTHER
                    if not custom_vtype:
                        custom_vtype = raw_type[:64]

            otype = VehicleOwnershipType.ATTACHED if vendor_id else VehicleOwnershipType.OWNED
            if item.ownership_type and item.ownership_type.strip():
                try:
                    otype = VehicleOwnershipType(item.ownership_type.strip().upper())
                except ValueError:
                    pass

            ftype = FuelType.DIESEL
            if item.fuel_type:
                try:
                    ftype = FuelType(item.fuel_type.strip().upper())
                except ValueError:
                    ftype = FuelType.DIESEL

            fastag_clean = item.fastag_id.strip().upper() if item.fastag_id else None
            gps_clean = item.gps_device_id.strip().upper() if item.gps_device_id else None

            # Unique FASTag check
            if fastag_clean:
                if fastag_clean in existing_fastags or fastag_clean in seen_fastags_in_batch:
                    errors.append(
                        {"row": row_num, "registration_number": reg_clean,
                         "error": f"FASTag ID '{fastag_clean}' is already assigned to another vehicle"}
                    )
                    continue
            # Unique GPS check
            if gps_clean:
                if gps_clean in existing_gps or gps_clean in seen_gps_in_batch:
                    errors.append(
                        {"row": row_num, "registration_number": reg_clean,
                         "error": f"GPS Device ID '{gps_clean}' is already assigned to another vehicle"}
                    )
                    continue

            vehicle = Vehicle(
                id=uuid.uuid4(),
                organisation_id=org_id,
                vendor_id=vendor_id,
                registration_number=reg_clean,
                vehicle_type=vtype,
                custom_vehicle_type=custom_vtype,
                ownership_type=otype,
                make=item.make.strip() if item.make else None,
                model=item.model.strip() if item.model else None,
                year=item.year,
                fuel_type=ftype,
                payload_capacity_kg=item.payload_capacity_kg,
                odometer_km=item.odometer_km or Decimal("0.0"),
                fastag_id=fastag_clean,
                gps_device_id=gps_clean,
                status=VehicleOperationalStatus.AVAILABLE,
                documents={},
            )
            db.add(vehicle)
            seen_in_batch.add(reg_clean)
            if fastag_clean:
                seen_fastags_in_batch.add(fastag_clean)
            if gps_clean:
                seen_gps_in_batch.add(gps_clean)
            succeeded += 1
        except Exception as e:
            reg = getattr(item, "registration_number", f"row-{row_num}")
            errors.append({"row": row_num, "registration_number": str(reg), "error": str(e)})

    if succeeded > 0:
        audit = AuditLog(
            id=uuid.uuid4(),
            organisation_id=org_id,
            actor_user_id=actor_id,
            entity_type="vehicles",
            entity_id=None,
            action="BULK_CREATE",
            metadata_={"count": succeeded},
        )
        db.add(audit)
        await db.commit()

    return VehicleBulkResult(
        total=len(items),
        succeeded=succeeded,
        failed=len(errors),
        errors=errors,
    )


async def list_vehicles(
    org_id: uuid.UUID,
    db: AsyncSession,
    tenant_ctx: Optional[TenantContext] = None,
    status_filter: Optional[VehicleOperationalStatus] = None,
    vehicle_type: Optional[VehicleBodyType] = None,
    ownership_type: Optional[VehicleOwnershipType] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> list[VehicleResponse]:
    stmt = select(Vehicle).where(Vehicle.organisation_id == org_id)

    if status_filter:
        stmt = stmt.where(Vehicle.status == status_filter)
    if vehicle_type:
        stmt = stmt.where(Vehicle.vehicle_type == vehicle_type)
    if ownership_type:
        stmt = stmt.where(Vehicle.ownership_type == ownership_type)
    if search:
        search_term = f"%{search.strip().upper().replace(' ', '')}%"
        stmt = stmt.where(Vehicle.registration_number.ilike(search_term))

    stmt = stmt.order_by(desc(Vehicle.created_at)).offset(skip).limit(limit)
    res = await db.execute(stmt)
    vehicles = list(res.scalars().all())
    return await _hydrate_vehicles(vehicles, db)


async def get_vehicle(
    org_id: uuid.UUID,
    vehicle_id: uuid.UUID,
    db: AsyncSession,
    tenant_ctx: Optional[TenantContext] = None,
) -> VehicleResponse:
    stmt = select(Vehicle).where(
        Vehicle.organisation_id == org_id,
        Vehicle.id == vehicle_id,
    )
    res = await db.execute(stmt)
    vehicle = res.scalars().first()
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found",
        )
    return (await _hydrate_vehicles([vehicle], db))[0]


async def update_vehicle(
    org_id: uuid.UUID,
    vehicle_id: uuid.UUID,
    actor_id: uuid.UUID,
    req: VehicleUpdate,
    db: AsyncSession,
    tenant_ctx: Optional[TenantContext] = None,
) -> VehicleResponse:
    stmt = select(Vehicle).where(
        Vehicle.organisation_id == org_id,
        Vehicle.id == vehicle_id,
    )
    res = await db.execute(stmt)
    vehicle = res.scalars().first()
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found",
        )

    update_data = req.model_dump(exclude_unset=True)
    if not update_data:
        return VehicleResponse.model_validate(vehicle)

    if "registration_number" in update_data and update_data["registration_number"]:
        reg_clean = update_data["registration_number"].strip().upper().replace(" ", "")
        chk_stmt = select(Vehicle).where(
            Vehicle.organisation_id == org_id,
            Vehicle.registration_number == reg_clean,
            Vehicle.id != vehicle_id,
        )
        chk_res = await db.execute(chk_stmt)
        if chk_res.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Vehicle '{reg_clean}' is already registered in your organisation",
            )
        vehicle.registration_number = reg_clean

    # Unique FASTag / GPS check (exclude self)
    new_fastag = update_data.get("fastag_id")
    new_gps = update_data.get("gps_device_id")
    if new_fastag is not None:
        new_fastag = new_fastag.strip().upper() if new_fastag else None
        update_data["fastag_id"] = new_fastag
    if new_gps is not None:
        new_gps = new_gps.strip().upper() if new_gps else None
        update_data["gps_device_id"] = new_gps
    await _check_unique_fields(org_id, new_fastag or None, new_gps or None, db, exclude_vehicle_id=vehicle_id)

    if "vendor_code" in update_data:
        vcode = update_data.pop("vendor_code")
        if vcode and str(vcode).strip():
            vehicle.vendor_id = await _resolve_vendor_id(org_id, None, str(vcode), db)
        elif "vendor_id" not in update_data:
            vehicle.vendor_id = None

    for field, val in update_data.items():
        if field == "registration_number":
            continue
        if hasattr(vehicle, field):
            setattr(vehicle, field, val)

    audit = AuditLog(
        id=uuid.uuid4(),
        organisation_id=org_id,
        actor_user_id=actor_id,
        entity_type="vehicles",
        entity_id=vehicle_id,
        action="UPDATE",
        metadata_={k: str(v) if v is not None else None for k, v in update_data.items()},
    )
    db.add(audit)

    await db.commit()
    await db.refresh(vehicle)
    return (await _hydrate_vehicles([vehicle], db))[0]


async def delete_vehicle(
    org_id: uuid.UUID,
    vehicle_id: uuid.UUID,
    actor_id: uuid.UUID,
    db: AsyncSession,
    tenant_ctx: Optional[TenantContext] = None,
) -> None:
    stmt = select(Vehicle).where(
        Vehicle.organisation_id == org_id,
        Vehicle.id == vehicle_id,
    )
    res = await db.execute(stmt)
    vehicle = res.scalars().first()
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found",
        )

    vehicle.status = VehicleOperationalStatus.DECOMMISSIONED

    audit = AuditLog(
        id=uuid.uuid4(),
        organisation_id=org_id,
        actor_user_id=actor_id,
        entity_type="vehicles",
        entity_id=vehicle_id,
        action="DELETE",
        metadata_={"status": "DECOMMISSIONED"},
    )
    db.add(audit)
    await db.commit()


async def upload_vehicle_doc(
    org_id: uuid.UUID,
    vehicle_id: uuid.UUID,
    doc_type: str,
    file_name: str,
    file_bytes: bytes,
    content_type: str,
    db: AsyncSession,
    tenant_ctx: Optional[TenantContext] = None,
) -> str:
    stmt = select(Vehicle).where(
        Vehicle.organisation_id == org_id,
        Vehicle.id == vehicle_id,
    )
    res = await db.execute(stmt)
    vehicle = res.scalars().first()
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found",
        )

    url = await upload_document_to_r2(
        file_bytes=file_bytes,
        file_name=file_name,
        content_type=content_type,
        folder=f"tenants/{org_id}/vehicles/{vehicle_id}",
    )

    docs = dict(vehicle.documents or {})
    docs[doc_type] = url
    vehicle.documents = docs

    await db.commit()
    return url
