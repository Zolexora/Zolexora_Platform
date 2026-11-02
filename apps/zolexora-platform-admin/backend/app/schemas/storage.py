from pydantic import BaseModel, Field
from typing import Literal

class PresignedUrlRequest(BaseModel):
    product: str = Field(min_length=1)
    file_key: str = Field(min_length=1, max_length=1024)
    operation: Literal["get_object", "put_object"] = "get_object"
    expiry_seconds: int = Field(3600, ge=60, le=3600)

class PresignedUrlResponse(BaseModel):
    url: str
    bucket: str
    file_key: str
    expires_in_seconds: int
