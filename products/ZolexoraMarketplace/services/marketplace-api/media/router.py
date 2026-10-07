import uuid
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status

from seller_orgs.dependencies import get_current_seller_org_member, require_active_seller_org
from .schemas import MediaIntentRequest, MediaIntentResponse, MediaAssetResponse
from .repository import PostgresMediaRepository
from .adapter import MediaStorageAdapter
from .dependencies import get_media_repo, get_media_adapter

router = APIRouter(tags=["media-management"])

@router.post(
    "/seller/organizations/{org_id}/media/intent",
    response_model=MediaIntentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Request a media upload intent",
)
async def request_media_upload_intent(
    org_id: uuid.UUID,
    payload: MediaIntentRequest,
    _org: dict[str, Any] = Depends(require_active_seller_org),
    _member: dict[str, Any] = Depends(get_current_seller_org_member),
    repo: PostgresMediaRepository = Depends(get_media_repo),
    adapter: MediaStorageAdapter = Depends(get_media_adapter),
):
    # The Pydantic model already validates the file type, size, and purpose.
    # Generate a unique storage key
    asset_uuid = uuid.uuid4()
    storage_key = f"media/{org_id}/{payload.purpose}/{asset_uuid}_{payload.filename}"

    # Insert pending record
    asset = await repo.create_asset(
        org_id=org_id,
        filename=payload.filename,
        content_type=payload.content_type,
        size_bytes=payload.size_bytes,
        storage_key=storage_key,
    )

    # Generate presigned URL
    expires_in = 3600
    upload_url = await adapter.generate_upload_url(
        storage_key=storage_key,
        content_type=payload.content_type,
        expires_in=expires_in,
    )

    return {
        "media_id": str(asset["id"]),
        "storage_key": storage_key,
        "upload_url": upload_url,
        "expires_in_seconds": expires_in,
    }

@router.post(
    "/seller/organizations/{org_id}/media/{media_id}/complete",
    response_model=MediaAssetResponse,
    summary="Mark a media upload as complete",
)
async def complete_media_upload(
    org_id: uuid.UUID,
    media_id: uuid.UUID,
    _org: dict[str, Any] = Depends(require_active_seller_org),
    _member: dict[str, Any] = Depends(get_current_seller_org_member),
    repo: PostgresMediaRepository = Depends(get_media_repo),
):
    asset = await repo.get_asset(media_id)
    if not asset:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Media asset not found")
        
    if asset["organization_id"] != org_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Media asset does not belong to this organization")
        
    if asset["status"] != "PENDING":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Media asset is not in PENDING state")
        
    updated_asset = await repo.update_asset_status(media_id, "ACTIVE")
    result = dict(updated_asset)
    result["id"] = str(result["id"])
    result["organization_id"] = str(result["organization_id"])
    return result
