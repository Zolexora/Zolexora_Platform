from fastapi import APIRouter
from ..schemas.telemetry import (
    CapacityTelemetryResponse,
    ArchivePreviewRequest,
    ArchivePreviewResponse,
    ArchiveExclusionToggleRequest,
    ArchiveExclusionsResponse,
    FleetResponse,
)
from ..db.telemetry import (
    get_capacity_telemetry,
    calculate_archive_preview,
    get_pinned_tables,
    toggle_table_pin,
    collect_fleet_telemetry,
)

router = APIRouter(prefix="/api/telemetry", tags=["Telemetry"])

@router.get("/fleet", response_model=FleetResponse)
async def get_fleet_telemetry() -> FleetResponse:
    """
    Returns live operational status of the Platform Admin stack, remote database targets,
    and monorepo application services.
    """
    return await collect_fleet_telemetry()

@router.get("/capacity", response_model=CapacityTelemetryResponse)
async def get_capacity() -> CapacityTelemetryResponse:
    """
    Returns live storage capacity metrics against free-tier limits (500MB Postgres, 512MB Mongo).
    Includes hot table profiling and threshold alert status.
    """
    return await get_capacity_telemetry()

@router.post("/archive/preview", response_model=ArchivePreviewResponse)
def preview_archive(request: ArchivePreviewRequest) -> ArchivePreviewResponse:
    """
    Calculates estimated historical records and cutoff date to shrink DB capacity to target % (default 40%).
    Respects hot storage pinned table exclusions.
    """
    return calculate_archive_preview(request.database, request.target_capacity_percent)

@router.get("/archive/exclusions", response_model=ArchiveExclusionsResponse)
def list_archive_exclusions() -> ArchiveExclusionsResponse:
    """
    Returns list of hot tables pinned to avoid auto-archiving.
    """
    return ArchiveExclusionsResponse(pinned_tables=get_pinned_tables())

@router.post("/archive/exclusions/toggle", response_model=ArchiveExclusionsResponse)
def toggle_archive_exclusion(request: ArchiveExclusionToggleRequest) -> ArchiveExclusionsResponse:
    """
    Toggles '[ 🔒 Pin to Hot Storage ]' on a table.
    """
    updated_pinned = toggle_table_pin(request.table_name, request.pinned)
    return ArchiveExclusionsResponse(pinned_tables=updated_pinned)
