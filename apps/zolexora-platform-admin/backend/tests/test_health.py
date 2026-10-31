import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.schemas.health import DatabaseTargetHealth
from app.db.health import check_supabase_health, check_mongo_health, get_system_health

def test_system_health_endpoint(client):
    """GET /api/health returns 200 with ok status."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "platform-admin-backend"
    assert data["version"] == "1.0.0"
    assert "timestamp" in data

def test_database_health_graceful_degradation_missing_secrets(client):
    """
    R1 requirement: Graceful non-blocking degradation.
    When credentials are missing, GET /api/health/databases must return HTTP 200 with degraded payloads,
    NEVER throwing an unhandled 500 error.
    """
    response = client.get("/api/health/databases")
    assert response.status_code == 200
    data = response.json()
    assert data["overall_status"] in ("healthy", "degraded")
    assert "targets" in data
    targets = data["targets"]

    assert "supabase_core" in targets
    assert "supabase_commerce" in targets
    assert "supabase_business" in targets
    assert "supabase_ai_erp" in targets
    assert "mongodb_atlas" in targets

    for key, target in targets.items():
        assert target["status"] in ("healthy", "degraded", "unconfigured")
        assert "latency_ms" in target
        assert "details" in target or "error" in target

@pytest.mark.asyncio
async def test_check_supabase_health_missing_credentials():
    """Directly test that check_supabase_health returns unconfigured when env vars are unset."""
    with patch("os.getenv", return_value=None):
        result = await check_supabase_health("core")
        assert result.status == "unconfigured"
        assert result.latency_ms == -1
        assert "Missing credentials" in (result.details or "")

@pytest.mark.asyncio
async def test_check_mongo_health_missing_credentials():
    """Directly test that check_mongo_health returns unconfigured when MONGO_URI is unset."""
    with patch("os.getenv", return_value=None):
        result = await check_mongo_health()
        assert result.status == "unconfigured"
        assert result.latency_ms == -1
        assert "Missing MONGO_URI" in (result.details or "")

@pytest.mark.asyncio
async def test_check_supabase_health_connection_error():
    """Test that connection exceptions degrade gracefully to status 'degraded'."""
    with patch("app.db.health.get_supabase_url", return_value="https://test.supabase.co"), \
         patch("app.db.health.get_supabase_key", return_value="test-key"), \
         patch("app.db.health.get_supabase") as mock_get_client:
        
        mock_client = MagicMock()
        mock_client.table.side_effect = ConnectionRefusedError("Supabase endpoint unreachable")
        mock_get_client.return_value = mock_client

        result = await check_supabase_health("core")
        assert result.status == "degraded"
        assert result.latency_ms == -1
        assert "unreachable" in (result.error or "")

@pytest.mark.asyncio
async def test_check_mongo_health_connection_error():
    """Test that MongoDB connection failures degrade gracefully to status 'degraded'."""
    with patch("os.getenv", return_value="mongodb://localhost:27017"), \
         patch("app.db.health.get_mongo") as mock_get_mongo:
        
        mock_db = MagicMock()
        mock_db.command = AsyncMock(side_effect=TimeoutError("MongoDB Atlas timeout"))
        mock_get_mongo.return_value = mock_db

        result = await check_mongo_health()
        assert result.status == "degraded"
        assert result.latency_ms == -1
        assert "timeout" in (result.error or "").lower()

@pytest.mark.asyncio
async def test_system_health_healthy_aggregation():
    """Test overall status calculation when all targets are healthy."""
    healthy_target = DatabaseTargetHealth(target="mock", status="healthy", latency_ms=10)
    with patch("app.db.health.check_supabase_health", AsyncMock(return_value=healthy_target)), \
         patch("app.db.health.check_mongo_health", AsyncMock(return_value=healthy_target)):
        report = await get_system_health()
        assert report.overall_status == "healthy"
        for t in report.targets.values():
            assert t.status == "healthy"
