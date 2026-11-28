from fastapi import APIRouter, Depends, HTTPException, status, Query, Body, Path, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
import asyncio
import io
import os
import re
import uuid
import datetime
import zipfile

from app.core.storage import download_document_bytes, upload_document_to_r2
from app.db.session import get_db
from app.auth.dependencies import get_current_user, require_permission
from app.modules.identity.users.models import Profile
from app.modules.core.compliance.models import (
    ComplianceRequirement,
    ComplianceRecord,
    ComplianceVerification,
    ComplianceStatus,
    ComplianceVerificationAction,
    ComplianceEntityType,
)
from app.modules.core.compliance.schemas import (
    ComplianceRequirementCreate,
    ComplianceRequirementUpdate,
    ComplianceRequirementResponse,
    ComplianceRecordCreate,
    ComplianceRecordUpdate,
    ComplianceRecordResponse, ComplianceWaiveRequest,
    ComplianceEvaluation,
)
from app.modules.core.compliance.engine import ComplianceEngine

router = APIRouter(prefix="/api/v1/compliance", tags=["Compliance"])

@router.get("/requirements", response_model=List[ComplianceRequirementResponse])
async def list_requirements(
    entity_type: Optional[ComplianceEntityType] = None,
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ComplianceRequirement).where(
        (ComplianceRequirement.organisation_id == current_user.organisation_id) | (ComplianceRequirement.organisation_id.is_(None))
    )
    if entity_type:
        stmt = stmt.where(ComplianceRequirement.entity_type == entity_type)
        
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/requirements", response_model=ComplianceRequirementResponse)
async def create_requirement(
    req: ComplianceRequirementCreate,
    current_user: Profile = Depends(require_permission("compliance.manage_rules")),
    db: AsyncSession = Depends(get_db),
):
    requirement = ComplianceRequirement(
        organisation_id=current_user.organisation_id,
        **req.model_dump()
    )
    db.add(requirement)
    await db.commit()
    await db.refresh(requirement)
    return requirement

@router.get("/records", response_model=List[ComplianceRecordResponse])
async def list_records(
    entity_type: Optional[ComplianceEntityType] = None,
    entity_id: Optional[uuid.UUID] = None,
    status: Optional[ComplianceStatus] = None,
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ComplianceRecord).where(ComplianceRecord.organisation_id == current_user.organisation_id)
    if entity_type:
        stmt = stmt.where(ComplianceRecord.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(ComplianceRecord.entity_id == entity_id)
    if status:
        stmt = stmt.where(ComplianceRecord.status == status)
        
    res = await db.execute(stmt)
    return res.scalars().all()

async def _upsert_record(req: ComplianceRecordCreate, org_id: uuid.UUID, db: AsyncSession) -> ComplianceRecord:
    req_obj = (await db.execute(select(ComplianceRequirement).where(
        ComplianceRequirement.id == req.requirement_id,
        (ComplianceRequirement.organisation_id == org_id) | (ComplianceRequirement.organisation_id.is_(None)),
    ))).scalars().first()
    if not req_obj:
        raise HTTPException(status_code=404, detail="Compliance requirement not found")

    record = (await db.execute(select(ComplianceRecord).where(
        ComplianceRecord.organisation_id == org_id,
        ComplianceRecord.requirement_id == req.requirement_id,
        ComplianceRecord.entity_id == req.entity_id,
        ComplianceRecord.entity_type == req.entity_type,
    ))).scalars().first()

    if record:
        for k, v in req.model_dump(exclude_unset=True).items():
            setattr(record, k, v)
        # A replacement document must be re-verified
        if req.document_url and record.status != ComplianceStatus.VALID:
            record.status = ComplianceStatus.VERIFICATION_REQUIRED if req_obj.verification_required else ComplianceStatus.VALID
    else:
        record = ComplianceRecord(organisation_id=org_id, **req.model_dump())
        if req.document_url and req_obj.verification_required:
            record.status = ComplianceStatus.VERIFICATION_REQUIRED
        db.add(record)

    await db.commit()
    await db.refresh(record)
    return record


@router.post("/records", response_model=ComplianceRecordResponse)
async def create_or_update_record(
    req: ComplianceRecordCreate,
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _upsert_record(req, current_user.organisation_id, db)


UPLOAD_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp"}
UPLOAD_MAX_BYTES = 10 * 1024 * 1024


@router.post("/records/upload", response_model=ComplianceRecordResponse)
async def upload_record_document(
    file: UploadFile = File(...),
    requirement_id: uuid.UUID = Form(...),
    entity_type: ComplianceEntityType = Form(...),
    entity_id: uuid.UUID = Form(...),
    document_number: Optional[str] = Form(None),
    expiry_date: Optional[datetime.date] = Form(None),
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stores the document in R2 and attaches it to the entity's compliance record."""
    if file.content_type not in UPLOAD_TYPES:
        raise HTTPException(status_code=415, detail="Only PDF, JPEG, PNG or WebP documents are accepted")
    data = await file.read(UPLOAD_MAX_BYTES + 1)
    if len(data) > UPLOAD_MAX_BYTES:
        raise HTTPException(status_code=413, detail="Document exceeds 10 MB")

    url = await upload_document_to_r2(
        file_bytes=data,
        file_name=file.filename or "document",
        content_type=file.content_type,
        folder=f"organisations/{current_user.organisation_id}/compliance/{entity_type.value.lower()}/{entity_id}",
    )
    req = ComplianceRecordCreate(
        requirement_id=requirement_id,
        entity_type=entity_type,
        entity_id=entity_id,
        status=ComplianceStatus.VERIFICATION_REQUIRED,
        document_number=document_number,
        document_url=url,
        original_filename=file.filename,
        mime_type=file.content_type,
        expiry_date=expiry_date,
    )
    return await _upsert_record(req, current_user.organisation_id, db)

@router.post("/records/{record_id}/verify", response_model=ComplianceRecordResponse)
async def verify_record(
    record_id: uuid.UUID = Path(...),
    method: str = Body(default="MANUAL"),
    comments: Optional[str] = Body(default=None),
    current_user: Profile = Depends(require_permission("compliance.verify")),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ComplianceRecord).where(
        ComplianceRecord.id == record_id,
        ComplianceRecord.organisation_id == current_user.organisation_id
    )
    res = await db.execute(stmt)
    record = res.scalars().first()
    if not record:
        raise HTTPException(status_code=404, detail="Compliance record not found")

    old_status = record.status
    record.status = ComplianceStatus.VALID
    record.verified_at = datetime.datetime.now(datetime.timezone.utc)
    record.verified_by = current_user.id
    record.verification_method = method

    verif = ComplianceVerification(
        organisation_id=current_user.organisation_id,
        compliance_record_id=record.id,
        action=ComplianceVerificationAction.VERIFY,
        previous_status=old_status,
        new_status=ComplianceStatus.VALID,
        actor_id=current_user.id,
        comments=comments
    )
    db.add(verif)
    
    await db.commit()
    await db.refresh(record)
    return record

@router.get("/evaluate", response_model=ComplianceEvaluation)
async def evaluate_compliance(
    vehicle_id: Optional[uuid.UUID] = None,
    driver_id: Optional[uuid.UUID] = None,
    vendor_id: Optional[uuid.UUID] = None,
    customer_id: Optional[uuid.UUID] = None,
    service_type: Optional[str] = None,
    state_code: Optional[str] = None,
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ComplianceEngine.evaluate(
        db=db,
        organisation_id=current_user.organisation_id,
        vehicle_id=vehicle_id,
        driver_id=driver_id,
        vendor_id=vendor_id,
        customer_id=customer_id,
        service_type=service_type,
        state_code=state_code,
    )

@router.post("/records/{record_id}/waive", response_model=ComplianceRecordResponse)
async def waive_compliance_record(
    record_id: uuid.UUID,
    waive_req: ComplianceWaiveRequest,
    current_user: Profile = Depends(require_permission("compliance.override")),
    db: AsyncSession = Depends(get_db),
):
    query = select(ComplianceRecord).filter(
        ComplianceRecord.id == record_id,
        ComplianceRecord.organisation_id == current_user.organisation_id
    )
    result = await db.execute(query)
    record = result.scalars().first()
    
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
        
    record.status = ComplianceStatus.WAIVED
    record.verified_by = current_user.id
    record.verified_at = datetime.datetime.now(datetime.timezone.utc)
    record.verification_method = "MANUAL_WAIVER"
    
    # Store reason in metadata
    meta = record.metadata_ or {}
    meta["waiver_reason"] = waive_req.reason
    meta["waived_by_email"] = current_user.email
    record.metadata_ = meta
    
    record.expiry_date = waive_req.valid_until
    
    await db.commit()
    await db.refresh(record)
    return record


def _safe_zip_segment(raw: str, fallback: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", (raw or "").strip())
    return cleaned[:100] or fallback


@router.get("/export-docs")
async def export_compliance_docs(
    entity_type: ComplianceEntityType = Query(...),
    entity_id: Optional[uuid.UUID] = Query(None),
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Exports uploaded compliance documents as a ZIP grouped into folders by
    registration number (VEHICLE), vendor name (VENDOR), or client name (CUSTOMER)."""
    org_id = current_user.organisation_id
    stmt = (
        select(ComplianceRecord)
        .options(selectinload(ComplianceRecord.requirement))
        .where(
            ComplianceRecord.organisation_id == org_id,
            ComplianceRecord.entity_type == entity_type,
            ComplianceRecord.document_url.is_not(None),
            ComplianceRecord.document_url != "",
        )
    )
    if entity_id is not None:
        stmt = stmt.where(ComplianceRecord.entity_id == entity_id)

    records = list((await db.execute(stmt)).scalars().all())
    if not records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No uploaded compliance documents found",
        )

    entity_ids = {r.entity_id for r in records}
    folder_map: dict[uuid.UUID, str] = {}

    if entity_type == ComplianceEntityType.VEHICLE:
        from app.modules.fleet.vehicles.models import Vehicle

        rows = (await db.execute(select(Vehicle.id, Vehicle.registration_number).where(Vehicle.id.in_(entity_ids)))).all()
        folder_map = {eid: _safe_zip_segment(reg, str(eid)) for eid, reg in rows}
    elif entity_type == ComplianceEntityType.VENDOR:
        from app.modules.crm.vendors.models import Vendor

        rows = (await db.execute(select(Vendor.id, Vendor.name).where(Vendor.id.in_(entity_ids)))).all()
        folder_map = {eid: _safe_zip_segment(name, str(eid)) for eid, name in rows}
    elif entity_type == ComplianceEntityType.CUSTOMER:
        from app.modules.crm.clients.models import Client

        rows = (await db.execute(select(Client.id, Client.name).where(Client.id.in_(entity_ids)))).all()
        folder_map = {eid: _safe_zip_segment(name, str(eid)) for eid, name in rows}

    downloads = await asyncio.gather(
        *(download_document_bytes(r.document_url or "") for r in records),
        return_exceptions=True,
    )

    buf = io.BytesIO()
    added_count = 0
    used_paths: set[str] = set()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for rec, content in zip(records, downloads):
            if not isinstance(content, bytes) or not content:
                continue
            folder = folder_map.get(rec.entity_id, str(rec.entity_id))
            req_label = _safe_zip_segment(
                rec.requirement.name if rec.requirement else str(rec.requirement_id),
                "document",
            )
            ext = ""
            if rec.original_filename:
                _, ext = os.path.splitext(rec.original_filename)
            if not ext and rec.document_url:
                _, ext = os.path.splitext(rec.document_url.split("?")[0])
            if not ext:
                ext = ".pdf"

            candidate = f"{folder}/{req_label}{ext}"
            counter = 2
            while candidate in used_paths:
                candidate = f"{folder}/{req_label}_{counter}{ext}"
                counter += 1
            used_paths.add(candidate)
            zf.writestr(candidate, content)
            added_count += 1

    if added_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Could not retrieve any uploaded compliance files",
        )

    if entity_id is not None:
        single_folder = folder_map.get(entity_id, str(entity_id))
        zip_name = f"{single_folder}_docs.zip"
    else:
        zip_name = f"{entity_type.value.lower()}_all_docs.zip"

    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_name}"'},
    )
