import os
from datetime import datetime, timezone
from fastapi import APIRouter
from ..schemas.health import SystemHealthResponse, DatabaseHealthReport
from ..db.health import get_system_health

router = APIRouter(prefix="/api/health", tags=["Health"])

@router.get("", response_model=SystemHealthResponse)
def get_system_health_status() -> SystemHealthResponse:
    """
    Returns high-level system service health status.
    """
    return SystemHealthResponse(
        status="ok",
        service="platform-admin-backend",
        version="1.0.0",
        environment=os.getenv("ENVIRONMENT", "development"),
        timestamp=datetime.now(timezone.utc).isoformat()
    )

@router.get("/databases", response_model=DatabaseHealthReport)
async def get_database_health() -> DatabaseHealthReport:
    """
    Returns structured health latency and status for all configured database targets.
    Returns HTTP 200 with degraded payloads if secrets are unconfigured, preventing 500 crashes.
    """
    return await get_system_health()
