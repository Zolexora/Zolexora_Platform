from fastapi import APIRouter, HTTPException
from ..schemas.storage import PresignedUrlRequest, PresignedUrlResponse
from ..db.connections import generate_r2_presigned_url, get_r2_bucket_for_product

router = APIRouter(prefix="/api/storage", tags=["Storage"])

@router.post("/presigned-url", response_model=PresignedUrlResponse)
def get_presigned_url(request: PresignedUrlRequest) -> PresignedUrlResponse:
    """
    Generates a pre-signed Cloudflare R2 URL.
    Resolves bucket based on target product (e.g. zolexora-ims -> zolexora-ims-files).
    """
    bucket = get_r2_bucket_for_product(request.product)
    try:
        url = generate_r2_presigned_url(bucket, request.file_key, request.operation, request.expiry_seconds)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    except Exception:
        raise HTTPException(502, "R2 could not sign the URL")

    return PresignedUrlResponse(
        url=url,
        bucket=bucket,
        file_key=request.file_key,
        expires_in_seconds=request.expiry_seconds
    )
