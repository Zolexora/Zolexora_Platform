"""Every runtime value comes from Infisical; nothing falls back to a default."""

import pytest

from core.config import Settings

REQUIRED = {
    "APP_ENV": "production",
    "AUTH_SERVICE_URL": "https://auth.zolexora.com",
    "DATABASE_URL": "postgresql://db/marketplace",
    "MONGO_URL": "mongodb://mongo/marketplace",
    "REDIS_URL": "redis://redis:6379/0",
    "CORS_ORIGINS": ["https://shop.zolexora.com"],
}


def _settings(monkeypatch, **values) -> Settings:
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    s = Settings()
    s.TESTING = False
    for key, value in {**REQUIRED, **values}.items():
        setattr(s, key, value)
    return s


def test_complete_config_passes(monkeypatch):
    _settings(monkeypatch).validate()


@pytest.mark.parametrize("key", sorted(REQUIRED))
def test_each_missing_value_fails(monkeypatch, key):
    with pytest.raises(RuntimeError, match=key):
        _settings(monkeypatch, **{key: [] if key == "CORS_ORIGINS" else ""}).validate()


def test_missing_app_env_is_not_development(monkeypatch):
    s = _settings(monkeypatch, APP_ENV="")
    assert not s.is_test_runtime()
    with pytest.raises(RuntimeError, match="APP_ENV"):
        s.validate()


def test_test_runtime_skips_validation(monkeypatch):
    _settings(monkeypatch, APP_ENV="test", DATABASE_URL="").validate()
