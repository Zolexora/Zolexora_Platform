import os
import uuid
import asyncpg
import pytest
from httpx import ASGITransport, AsyncClient

from main import app as marketplace_app
from shared.database.postgres import pg_conn_dep
from core.deps import current_user

# Use DATABASE_URL environment variable set by CI workflow, fallback for local development
TEST_URL = os.environ.get("DATABASE_URL", "postgresql://marketplace_local:marketplace-local-only@localhost:5432/marketplace_local")

@pytest.fixture
async def pg_conn():
    conn = await asyncpg.connect(TEST_URL)
    transaction = conn.transaction()
    await transaction.start()
    try:
        yield conn
    finally:
        await transaction.rollback()
        await conn.close()

@pytest.fixture
async def seed_data(pg_conn):
    user_id = uuid.uuid4()
    org_id = uuid.uuid4()
    
    await pg_conn.execute(
        "INSERT INTO users (id, email, is_active, is_email_verified) VALUES ($1, $2, true, true)",
        user_id, f"test_{user_id.hex[:6]}@example.com"
    )
    
    await pg_conn.execute(
        "INSERT INTO seller_organization (id, name, slug, status, verification_status) VALUES ($1, $2, $3, 'ACTIVE', 'VERIFIED')",
        org_id, "Test Org", f"test-org-{org_id.hex[:6]}"
    )
    
    await pg_conn.execute(
        "INSERT INTO seller_org_member (id, organization_id, user_id, role, status) VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')",
        uuid.uuid4(), org_id, user_id
    )
    
    return {"user_id": user_id, "org_id": org_id}

@pytest.mark.asyncio
async def test_valid_media_upload_intent(pg_conn, seed_data):
    user_payload = {"id": str(seed_data["user_id"]), "role": "seller"}
    marketplace_app.dependency_overrides[pg_conn_dep] = lambda: pg_conn
    marketplace_app.dependency_overrides[current_user] = lambda: user_payload
    
    try:
        async with AsyncClient(transport=ASGITransport(app=marketplace_app), base_url="http://test") as client:
            org_id = seed_data["org_id"]
            res = await client.post(
                f"/api/seller/organizations/{org_id}/media/intent",
                json={
                    "filename": "test_image.jpg",
                    "content_type": "image/jpeg",
                    "size_bytes": 1024 * 1024, # 1MB
                    "purpose": "product_image"
                }
            )
            assert res.status_code == 201
            data = res.json()
            assert "media_id" in data
            assert "upload_url" in data
            assert data["storage_key"].startswith(f"media/{org_id}/product_image/")
            
            # Verify DB state
            asset = await pg_conn.fetchrow("SELECT * FROM media_asset WHERE id = $1", uuid.UUID(data["media_id"]))
            assert asset["status"] == "PENDING"
            assert asset["filename"] == "test_image.jpg"
            assert asset["content_type"] == "image/jpeg"
    finally:
        marketplace_app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_invalid_media_type_rejected(pg_conn, seed_data):
    user_payload = {"id": str(seed_data["user_id"]), "role": "seller"}
    marketplace_app.dependency_overrides[pg_conn_dep] = lambda: pg_conn
    marketplace_app.dependency_overrides[current_user] = lambda: user_payload
    
    try:
        async with AsyncClient(transport=ASGITransport(app=marketplace_app), base_url="http://test") as client:
            org_id = seed_data["org_id"]
            res = await client.post(
                f"/api/seller/organizations/{org_id}/media/intent",
                json={
                    "filename": "malicious.exe",
                    "content_type": "application/x-msdownload",
                    "size_bytes": 1024,
                    "purpose": "product_image"
                }
            )
            assert res.status_code == 422 # Pydantic validation error
    finally:
        marketplace_app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_oversized_image_rejected(pg_conn, seed_data):
    user_payload = {"id": str(seed_data["user_id"]), "role": "seller"}
    marketplace_app.dependency_overrides[pg_conn_dep] = lambda: pg_conn
    marketplace_app.dependency_overrides[current_user] = lambda: user_payload
    
    try:
        async with AsyncClient(transport=ASGITransport(app=marketplace_app), base_url="http://test") as client:
            org_id = seed_data["org_id"]
            res = await client.post(
                f"/api/seller/organizations/{org_id}/media/intent",
                json={
                    "filename": "huge_image.jpg",
                    "content_type": "image/jpeg",
                    "size_bytes": 10 * 1024 * 1024, # 10MB (limit is 5MB for images)
                    "purpose": "product_image"
                }
            )
            assert res.status_code == 422
    finally:
        marketplace_app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_forged_ownership_rejected(pg_conn, seed_data):
    other_org_id = uuid.uuid4()
    await pg_conn.execute(
        "INSERT INTO seller_organization (id, name, slug, status, verification_status) VALUES ($1, $2, $3, 'ACTIVE', 'VERIFIED')",
        other_org_id, "Other Org", f"other-org-{other_org_id.hex[:6]}"
    )
    
    user_payload = {"id": str(seed_data["user_id"]), "role": "seller"}
    marketplace_app.dependency_overrides[pg_conn_dep] = lambda: pg_conn
    marketplace_app.dependency_overrides[current_user] = lambda: user_payload
    
    try:
        async with AsyncClient(transport=ASGITransport(app=marketplace_app), base_url="http://test") as client:
            res = await client.post(
                f"/api/seller/organizations/{other_org_id}/media/intent",
                json={
                    "filename": "test_image.jpg",
                    "content_type": "image/jpeg",
                    "size_bytes": 1024 * 1024,
                    "purpose": "product_image"
                }
            )
            assert res.status_code == 403 # Not a member of this org
    finally:
        marketplace_app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_mark_upload_complete(pg_conn, seed_data):
    user_payload = {"id": str(seed_data["user_id"]), "role": "seller"}
    marketplace_app.dependency_overrides[pg_conn_dep] = lambda: pg_conn
    marketplace_app.dependency_overrides[current_user] = lambda: user_payload
    
    try:
        async with AsyncClient(transport=ASGITransport(app=marketplace_app), base_url="http://test") as client:
            org_id = seed_data["org_id"]
            
            # 1. Create intent
            res = await client.post(
                f"/api/seller/organizations/{org_id}/media/intent",
                json={
                    "filename": "test_image.jpg",
                    "content_type": "image/jpeg",
                    "size_bytes": 1024 * 1024,
                    "purpose": "product_image"
                }
            )
            assert res.status_code == 201
            media_id = res.json()["media_id"]
            
            # 2. Mark complete
            res2 = await client.post(
                f"/api/seller/organizations/{org_id}/media/{media_id}/complete"
            )
            assert res2.status_code == 200
            
            # Verify DB state
            asset = await pg_conn.fetchrow("SELECT * FROM media_asset WHERE id = $1", uuid.UUID(media_id))
            assert asset["status"] == "ACTIVE"
    finally:
        marketplace_app.dependency_overrides.clear()
