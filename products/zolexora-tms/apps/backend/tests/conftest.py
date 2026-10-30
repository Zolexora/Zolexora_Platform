import os

# Must be set before app settings are imported: enables HS256 test tokens only under test.
os.environ.setdefault("NODE_ENV", "test")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-testing")

import pytest
from app.db.session import engine


@pytest.fixture(autouse=True)
async def cleanup_engine():
    yield
    await engine.dispose()
