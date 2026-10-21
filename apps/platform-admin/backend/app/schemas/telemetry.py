from pydantic import BaseModel
from typing import List, Optional, Literal

class HotTableMetric(BaseModel):
    schema_name: str
    table_name: str
    row_count_estimate: int
    total_bytes: int
    total_size_pretty: str
    read_activity_score: Optional[int] = None
    is_pinned: bool = False

class StorageQuotaMetric(BaseModel):
    service: str
    project_or_cluster: str
    free_tier_limit_bytes: int
    used_bytes: int
    used_pretty: str
    usage_percentage: float
    threshold_state: Literal["NORMAL", "WARNING", "CRITICAL", "UNCONFIGURED"]
    is_configured: bool = False
    infisical_path: Optional[str] = None
    tables: Optional[List[HotTableMetric]] = None

class CapacityTelemetryResponse(BaseModel):
    databases: List[StorageQuotaMetric]
    overall_threshold_alert: bool
    hot_tables: List[HotTableMetric]
    timestamp: str

class ArchivePreviewRequest(BaseModel):
    database: str
    target_capacity_percent: float = 40.0

class ArchivePreviewResponse(BaseModel):
    database: str
    current_usage_bytes: int
    target_usage_bytes: int
    estimated_rows_to_archive: int
    cutoff_date: str
    pinned_tables_skipped: List[str] = []

class ArchiveExclusionToggleRequest(BaseModel):
    table_name: str
    pinned: bool

class ArchiveExclusionsResponse(BaseModel):
    pinned_tables: List[str]

class FleetService(BaseModel):
    id: str
    name: str
    category: Literal["frontend", "backend", "database", "worker", "edge"]
    environment: str
    host: str
    endpoint: str
    status: Literal["operational", "degraded", "critical", "stopped", "unconfigured"]
    latency_ms: Optional[int] = None
    last_checked: str
    details: Optional[str] = None

class FleetResponse(BaseModel):
    services: List[FleetService]
    total_count: int
    operational_count: int
    degraded_count: int
    stopped_count: int
    unconfigured_count: int
    timestamp: str
