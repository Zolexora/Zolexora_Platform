from fastapi import APIRouter, HTTPException
from ..connections import get_connection
from ..schemas.telemetry import (
    ArchiveExclusionToggleRequest, ArchiveExclusionsResponse, ArchivePreviewRequest, ArchivePreviewResponse,
    CapacityTelemetryResponse, FleetResponse,
)
from ..services import telemetry

router = APIRouter(prefix="/api/telemetry", tags=["Telemetry"])


@router.get("/fleet", response_model=FleetResponse)
async def get_fleet_telemetry() -> FleetResponse:
    """Admin stack plus a live probe of every connection."""
    return await telemetry.fleet()


@router.get("/capacity", response_model=CapacityTelemetryResponse)
async def get_capacity() -> CapacityTelemetryResponse:
    """Storage used vs free-tier limits for database connections, plus the largest tables."""
    return await telemetry.capacity()


@router.post("/archive/preview", response_model=ArchivePreviewResponse)
async def preview_archive(request: ArchivePreviewRequest) -> ArchivePreviewResponse:
    conn = await get_connection(request.database)
    if conn is None or conn.provider not in ("supabase", "mongodb"):
        raise HTTPException(422, f"'{request.database}' is not a database connection.")
    return await telemetry.archive_preview(conn, request.target_capacity_percent)


@router.get("/archive/exclusions", response_model=ArchiveExclusionsResponse)
def list_archive_exclusions() -> ArchiveExclusionsResponse:
    return ArchiveExclusionsResponse(pinned_tables=telemetry.get_pinned_tables())


@router.post("/archive/exclusions/toggle", response_model=ArchiveExclusionsResponse)
def toggle_archive_exclusion(request: ArchiveExclusionToggleRequest) -> ArchiveExclusionsResponse:
    return ArchiveExclusionsResponse(pinned_tables=telemetry.toggle_table_pin(request.table_name, request.pinned))
