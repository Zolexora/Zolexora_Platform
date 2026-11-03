import os

# Test-only values (no secrets): the app reads its configuration at import time.
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("CORS_ORIGINS", "https://shop.zolexora.com,https://mahilamadel.store,https://seller.zolexora.com,https://admin.marketplace.zolexora.com")

import pytest

from tests.test_postgresql_foundation import db_connection, postgres_database

__all__ = ["db_connection", "postgres_database"]


@pytest.fixture(autouse=True)
def _fake_catalog_for_mongo_tests(monkeypatch):
    """Tests whose fake Mongo DB called fake_catalog.use() read the catalog from those seeds."""
    from catalog import store
    from tests import fake_catalog

    for name in ("public_listing", "public_listings"):
        real, fake = getattr(store, name), getattr(fake_catalog, name)

        async def either(*args, _real=real, _fake=fake, **kwargs):
            return await (_fake if fake_catalog.active() else _real)(*args, **kwargs)

        monkeypatch.setattr(store, name, either)
    yield
    fake_catalog.reset()
