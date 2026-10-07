from typing import Optional, List, Dict, Any
from .base import APIModel

class ErrorDetail(APIModel):
    code: str
    message: str
    details: List[Dict[str, Any]] = []
    request_id: Optional[str] = None

class ErrorResponse(APIModel):
    error: ErrorDetail
