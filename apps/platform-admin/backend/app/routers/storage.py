from fastapi import APIRouter
from ..schemas.storage import PresignedUrlRequest, PresignedUrlResponse
from ..db.connections import generate_r2_presigned_url, get_r2_bucket_for_product

router = APIRouter(prefix="/api/storage", tags=["Storage"])

@router.post("/presigned-url", response_model=PresignedUrlResponse)
def get_presigned_url(request: PresignedUrlRequest) -> PresignedUrlResponse:
    """
    Generates a secure pre-signed Cloudflare R2 URL using boto3.
    Resolves bucket based on target product (e.g. zolexora-ims -> zolexora-ims-files).
    """
    bucket = get_r2_bucket_for_product(request.product)
    url = generate_r2_presigned_url(
        bucket=bucket,
        file_key=request.file_key,
        operation=request.operation,
        expiry_seconds=request.expiry_seconds
    )

    return PresignedUrlResponse(
        url=url,
        bucket=bucket,
        file_key=request.file_key,
        expires_in_seconds=request.expiry_seconds
    )
