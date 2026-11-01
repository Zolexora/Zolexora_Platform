from typing import Any, Dict
import uuid
from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.auth.dependencies import OrgContext, get_org_context
from app.modules.core.extensions.r1rcm.schemas import R1ImportPreviewResponse, R1ConfirmImportRequest
from app.modules.core.extensions.r1rcm import service

router = APIRouter(prefix="/api/v1/operations/r1rcm", tags=["R1 RCM Operations"])


@router.post("/import", response_model=R1ImportPreviewResponse)
async def upload_r1_excel(
    file: UploadFile = File(...),
    customer_id: uuid.UUID = Form(...),
    location: str = Form(..., min_length=1),
    ctx: OrgContext = Depends(get_org_context),
):
    return await service.process_excel_upload(ctx, file, customer_id, location)


@router.post("/import/confirm")
async def confirm_r1_import(
    req: R1ConfirmImportRequest,
    ctx: OrgContext = Depends(get_org_context),
) -> Dict[str, Any]:
    return await service.confirm_import(ctx, req)
