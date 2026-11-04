import os

# Test-only values (no secrets): the app reads its configuration at import time.
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("CORS_ORIGINS", "https://shop.zolexora.com,https://mahilamadel.store,https://seller.zolexora.com,https://admin.marketplace.zolexora.com")

from tests.commerce_seed import pg
from tests.test_postgresql_foundation import db_connection, postgres_database

__all__ = ["db_connection", "pg", "postgres_database"]
