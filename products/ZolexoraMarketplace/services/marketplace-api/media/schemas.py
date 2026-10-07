from typing import Annotated
from pydantic import ConfigDict, Field, StringConstraints, model_validator
from models.base import APIModel
from models.primitives import EntityId, UTCDateTime

class MediaIntentRequest(APIModel):
    model_config = ConfigDict(extra="forbid")
    
    filename: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=256)]
    content_type: str
    size_bytes: int = Field(gt=0, le=52428800) # Max 50MB
    purpose: str

    @model_validator(mode="after")
    def validate_content_type(self):
        valid_types = {"image/jpeg", "image/png", "image/webp", "video/mp4"}
        if self.content_type not in valid_types:
            raise ValueError(f"Unsupported media type: {self.content_type}")
            
        # Size limits based on type
        is_image = self.content_type.startswith("image/")
        if is_image and self.size_bytes > 5 * 1024 * 1024:
            raise ValueError("Images must be under 5MB")
            
        return self

class MediaIntentResponse(APIModel):
    media_id: EntityId
    storage_key: str
    upload_url: str
    expires_in_seconds: int = 3600

class MediaAssetResponse(APIModel):
    id: EntityId
    filename: str
    content_type: str
    size_bytes: int
    storage_key: str
    status: str
    created_at: UTCDateTime
    updated_at: UTCDateTime
