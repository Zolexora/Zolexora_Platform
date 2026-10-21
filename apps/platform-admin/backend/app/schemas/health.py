from pydantic import BaseModel
from typing import Dict, Optional, Literal

class SystemHealthResponse(BaseModel):
    status: Literal["ok", "degraded", "unhealthy"]
    service: str = "platform-admin-backend"
    version: str = "1.0.0"
    environment: str = "development"
    timestamp: str

class DatabaseTargetHealth(BaseModel):
    target: str
    status: Literal["healthy", "degraded", "unhealthy", "unconfigured"]
    latency_ms: int
    details: Optional[str] = None
    error: Optional[str] = None

class DatabaseHealthReport(BaseModel):
    overall_status: Literal["healthy", "degraded", "unhealthy"]
    targets: Dict[str, DatabaseTargetHealth]
    timestamp: str
