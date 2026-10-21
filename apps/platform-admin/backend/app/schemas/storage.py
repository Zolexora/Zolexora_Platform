from pydantic import BaseModel
from typing import Literal

class PresignedUrlRequest(BaseModel):
    product: str
    file_key: str
    operation: Literal["get_object", "put_object"] = "get_object"
    expiry_seconds: int = 3600

class PresignedUrlResponse(BaseModel):
    url: str
    bucket: str
    file_key: str
    expires_in_seconds: int
