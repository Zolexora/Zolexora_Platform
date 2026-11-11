import pytest
from httpx import ASGITransport, AsyncClient
from main import app

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

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
    assert not any(path.startswith("/api/auth/") for path in schema["paths"])  # sign-in is the auth service
    assert "/api/products" in schema["paths"]
    assert "/api/shipping/admin/shipments/stats" in schema["paths"]
