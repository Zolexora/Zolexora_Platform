from typing import Protocol

class MediaStorageAdapter(Protocol):
    async def generate_upload_url(self, storage_key: str, content_type: str, expires_in: int = 3600) -> str:
        ...

class DummyS3Adapter:
    """
    S3-compatible dummy adapter for testing.
    In production, this would use aioboto3 to generate presigned URLs for OCI Object Storage.
    """
    async def generate_upload_url(self, storage_key: str, content_type: str, expires_in: int = 3600) -> str:
        # Generate a fake presigned URL for local testing
        return f"https://mock-s3-bucket.localhost/{storage_key}?X-Amz-Signature=dummy"
