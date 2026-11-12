import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from ..auth import require_platform_admin
from ..schemas.health import SystemHealthResponse, DatabaseHealthReport
from ..services.telemetry import database_health

router = APIRouter(prefix="/api/health", tags=["Health"])


@router.get("", response_model=SystemHealthResponse)
def get_system_health_status() -> SystemHealthResponse:
    """Liveness probe (no auth)."""
    return SystemHealthResponse(
        status="ok",
        service="platform-admin-backend",
        version="1.0.0",
        environment=os.getenv("ENVIRONMENT", "development"),
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/databases", response_model=DatabaseHealthReport, dependencies=[Depends(require_platform_admin)])
async def get_database_health() -> DatabaseHealthReport:
    """Probes every Supabase and MongoDB connection."""
    return await database_health()
