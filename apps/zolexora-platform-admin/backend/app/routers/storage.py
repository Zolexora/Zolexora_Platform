import asyncio
from fastapi import APIRouter, HTTPException
from .. import clients
from ..connections import get_connection
from ..schemas.storage import PresignedUrlRequest, PresignedUrlResponse

router = APIRouter(prefix="/api/storage", tags=["Storage"])


@router.post("/presigned-url", response_model=PresignedUrlResponse)
async def get_presigned_url(request: PresignedUrlRequest) -> PresignedUrlResponse:
    """Pre-signed URL for a file in an R2 connection's bucket."""
    conn = await get_connection(request.connection_id)
    if conn is None or conn.provider != "r2":
        raise HTTPException(404, "R2 connection not found")
    if conn.status != "ACTIVE":
        raise HTTPException(409, "Connection is draining")
    if conn.error:
        raise HTTPException(409, conn.error)
    bucket = conn.config["bucket"]
    try:
        url = await asyncio.to_thread(
            clients.r2_client(conn).generate_presigned_url,
            ClientMethod=request.operation,
            Params={"Bucket": bucket, "Key": request.file_key},
            ExpiresIn=request.expiry_seconds,
        )
    except Exception:
        raise HTTPException(502, "R2 could not sign the URL")
    return PresignedUrlResponse(url=url, bucket=bucket, file_key=request.file_key, expires_in_seconds=request.expiry_seconds)
