import pytest
from httpx import ASGITransport, AsyncClient
from main import app
from core.deps import db_dep
from mongomock_motor import AsyncMongoMockClient

@pytest.fixture
async def mock_db():
    client = AsyncMongoMockClient()
    return client["test_db"]

@pytest.fixture
async def client(mock_db):
    # Override dependency
    app.dependency_overrides[db_dep] = lambda: mock_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_health_check(client):
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data

@pytest.mark.asyncio
async def test_docs_and_openapi(client):
    docs = await client.get("/docs")
    assert docs.status_code == 200

    response = await client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert schema["info"]["title"] == "Zolexora API"
    assert "/api/health" in schema["paths"]
    assert "/api/auth/login" in schema["paths"]
    assert "/api/products" in schema["paths"]
    assert "/api/shipping/admin/shipments/stats" in schema["paths"]
