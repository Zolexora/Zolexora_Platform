import pytest
from app.db.config import (
    PRODUCT_DB_MAP,
    MONGO_DB_MAP,
    D1_DB_MAP,
    get_pg_pool_dsn,
    get_supabase_url,
)
from app.db.connections import get_supabase, get_mongo

def test_product_db_map_completeness():
    """Verify all 11 monorepo products are registered with schema and Supavisor port 6543."""
    expected_products = [
        "zolexora-ims", "zolexora-marketplace", "zolexora-tms",
        "textile-care", "rento-easy", "platform-admin",
        "zolexora-engage", "clarity-fi", "maun-kavach",
        "zolexora-ai", "erp-supplements"
    ]
    for product in expected_products:
        assert product in PRODUCT_DB_MAP
        config = PRODUCT_DB_MAP[product]
        assert "supabase_project" in config
        assert "schema" in config
        assert config["pool_port"] == 6543

def test_supabase_project_groupings():
    """Verify products are grouped into the 4 consolidated Supabase projects."""
    core_products = ["zolexora-ims", "zolexora-marketplace", "zolexora-tms"]
    commerce_products = ["textile-care", "rento-easy", "platform-admin"]
    business_products = ["zolexora-engage", "clarity-fi", "maun-kavach"]
    ai_erp_products = ["zolexora-ai", "erp-supplements"]

    for p in core_products:
        assert PRODUCT_DB_MAP[p]["supabase_project"] == "core"
    for p in commerce_products:
        assert PRODUCT_DB_MAP[p]["supabase_project"] == "commerce"
    for p in business_products:
        assert PRODUCT_DB_MAP[p]["supabase_project"] == "business"
    for p in ai_erp_products:
        assert PRODUCT_DB_MAP[p]["supabase_project"] == "ai_erp"

def test_mongo_db_mapping():
    """Verify mapped document databases inside shared MongoDB Atlas cluster."""
    assert MONGO_DB_MAP["zolexora-ai"] == "db_ai"
    assert MONGO_DB_MAP["zolexora-tms"] == "db_tms"
    assert MONGO_DB_MAP["zolexora-engage"] == "db_engage"

def test_d1_db_mapping():
    """Verify Cloudflare D1 edge database mappings."""
    assert D1_DB_MAP["sessions"] == "D1_SESSIONS_ID"
    assert D1_DB_MAP["catalog"] == "D1_CATALOG_ID"
    assert D1_DB_MAP["config"] == "D1_CONFIG_ID"
    assert D1_DB_MAP["routes"] == "D1_ROUTES_ID"

def test_unknown_product_raises_error():
    """Querying an unknown product from the router must raise explicit ValueError."""
    with pytest.raises(ValueError, match="Unknown product 'unknown-product'"):
        get_supabase("unknown-product")

@pytest.mark.asyncio
async def test_unknown_mongo_product_raises_error():
    """Querying unknown product for MongoDB must raise ValueError."""
    with pytest.raises(ValueError, match="Unknown product 'non-existent'"):
        await get_mongo("non-existent")

def test_get_pg_pool_dsn_construction(monkeypatch):
    """Test Supavisor asyncpg DSN construction including port 6543 and search_path."""
    monkeypatch.setenv("SUPABASE_CORE_HOST", "aws-0-us-east-1.pooler.supabase.com")
    monkeypatch.setenv("SUPABASE_CORE_USER", "postgres.testproject")
    monkeypatch.setenv("SUPABASE_CORE_PASSWORD", "secretpass")
    monkeypatch.setenv("SUPABASE_CORE_DB", "postgres")
    monkeypatch.setenv("SUPABASE_CORE_PORT", "6543")

    dsn = get_pg_pool_dsn("core", schema="ims")
    assert dsn is not None
    assert "postgresql://postgres.testproject:secretpass@aws-0-us-east-1.pooler.supabase.com:6543/postgres" in dsn
    assert "options=-csearch_path%3Dims" in dsn

def test_missing_credentials_raise_or_none(monkeypatch):
    """Test helper functions with raise_on_missing toggle."""
    monkeypatch.delenv("SUPABASE_CORE_URL", raising=False)
    assert get_supabase_url("core", raise_on_missing=False) is None
    with pytest.raises(ValueError, match="Missing environment variable"):
        get_supabase_url("core", raise_on_missing=True)
