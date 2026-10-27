from decimal import Decimal
import uuid
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.storage import upload_document_to_r2
from app.core.tenant import TenantContext
from app.modules.core.audit.models import AuditLog
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

    vehicle = Vehicle(
        id=uuid.uuid4(),
        organisation_id=org_id,
        vendor_id=req.vendor_id,
        registration_number=reg_clean,
        vehicle_type=req.vehicle_type or VehicleBodyType.TRUCK,
        ownership_type=req.ownership_type or VehicleOwnershipType.OWNED,
        make=req.make.strip() if req.make else None,
        model=req.model.strip() if req.model else None,
        year=req.year,
        fuel_type=FuelType(req.fuel_type) if req.fuel_type else FuelType.DIESEL,
        payload_capacity_kg=req.payload_capacity_kg,
        volume_cft=req.volume_cft,
        odometer_km=req.odometer_km or Decimal("0.0"),
        fastag_id=req.fastag_id.strip() if req.fastag_id else None,
        gps_device_id=req.gps_device_id.strip() if req.gps_device_id else None,
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
        entity_name="vehicles",
        entity_id=vehicle.id,
        action="CREATE",
        old_data=None,
        new_data={"registration_number": reg_clean, "status": "AVAILABLE"},
    )
    db.add(audit)

    await db.commit()
    await db.refresh(vehicle)
    return VehicleResponse.model_validate(vehicle)


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

            vtype = VehicleBodyType.TRUCK
            if item.vehicle_type:
                try:
                    vtype = VehicleBodyType(item.vehicle_type.strip().upper())
                except ValueError:
                    vtype = VehicleBodyType.TRUCK

            otype = VehicleOwnershipType.OWNED
            if item.ownership_type:
                try:
                    otype = VehicleOwnershipType(item.ownership_type.strip().upper())
                except ValueError:
                    otype = VehicleOwnershipType.OWNED

            ftype = FuelType.DIESEL
            if item.fuel_type:
                try:
                    ftype = FuelType(item.fuel_type.strip().upper())
                except ValueError:
                    ftype = FuelType.DIESEL

            vehicle = Vehicle(
                id=uuid.uuid4(),
                organisation_id=org_id,
                registration_number=reg_clean,
                vehicle_type=vtype,
                ownership_type=otype,
                make=item.make.strip() if item.make else None,
                model=item.model.strip() if item.model else None,
                year=item.year,
                fuel_type=ftype,
                payload_capacity_kg=item.payload_capacity_kg,
                odometer_km=item.odometer_km or Decimal("0.0"),
                fastag_id=item.fastag_id.strip().upper() if item.fastag_id else None,
                gps_device_id=item.gps_device_id.strip().upper() if item.gps_device_id else None,
                status=VehicleOperationalStatus.AVAILABLE,
                documents={},
            )
            db.add(vehicle)
            seen_in_batch.add(reg_clean)
            succeeded += 1
        except Exception as e:
            reg = getattr(item, "registration_number", f"row-{row_num}")
            errors.append({"row": row_num, "registration_number": str(reg), "error": str(e)})

    if succeeded > 0:
        audit = AuditLog(
            id=uuid.uuid4(),
            organisation_id=org_id,
            actor_user_id=actor_id,
            entity_name="vehicles",
            entity_id=None,
            action="BULK_CREATE",
            old_data=None,
            new_data={"count": succeeded},
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
    vehicles = res.scalars().all()
    return [VehicleResponse.model_validate(v) for v in vehicles]


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
    return VehicleResponse.model_validate(vehicle)


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

    for field, val in update_data.items():
        if field == "registration_number":
            continue
        if hasattr(vehicle, field):
            setattr(vehicle, field, val)

    audit = AuditLog(
        id=uuid.uuid4(),
        organisation_id=org_id,
        actor_user_id=actor_id,
        entity_name="vehicles",
        entity_id=vehicle_id,
        action="UPDATE",
        old_data=None,
        new_data=update_data,
    )
    db.add(audit)

    await db.commit()
    await db.refresh(vehicle)
    return VehicleResponse.model_validate(vehicle)


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
        entity_name="vehicles",
        entity_id=vehicle_id,
        action="DELETE",
        old_data=None,
        new_data={"status": "DECOMMISSIONED"},
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
