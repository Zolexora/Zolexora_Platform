import pytest
from pydantic import SecretStr

from core.config import Settings


def make_settings(**overrides):
    settings = Settings()
    defaults = {
        "APP_ENV": "production",
        "TESTING": False,
        "SKIP_STARTUP_ENV_VALIDATION": False,
        "MONGO_URL": "",
        "REDIS_URL": "",
        "AUTH_OTP_PEPPER": None,
        "DATABASE_URL": "",
        "DEFAULT_ADMIN_EMAIL": "",
        "DEFAULT_ADMIN_PASSWORD": "",
    }
    defaults.update(overrides)
    for key, value in defaults.items():
        setattr(settings, key, value)
    return settings


def test_production_missing_postgres_env_fails(monkeypatch):
    monkeypatch.delenv("TESTING", raising=False)
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    settings = make_settings()

    with pytest.raises(RuntimeError) as exc_info:
        settings.validate_required_runtime_config()

    message = str(exc_info.value)
    assert "MONGO_URL" in message
    assert "REDIS_URL" in message
    assert "AUTH_OTP_PEPPER" in message
    assert "DATABASE_URL" in message
    assert "service-role-secret" not in message


def test_production_complete_env_passes(monkeypatch):
    monkeypatch.delenv("TESTING", raising=False)
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    settings = make_settings(
        MONGO_URL="mongodb://example",
        REDIS_URL="redis://cache.invalid:6379/0",
        AUTH_OTP_PEPPER=SecretStr("test-only-pepper"),
        DATABASE_URL="postgresql://postgres:secret@example/postgres",
    )

    settings.validate_required_runtime_config()


def test_testing_env_bypasses_runtime_validation(monkeypatch):
    monkeypatch.setenv("TESTING", "true")
    settings = make_settings()

    settings.validate_required_runtime_config()


def test_skip_validation_does_not_bypass_production(monkeypatch):
    monkeypatch.delenv("TESTING", raising=False)
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    settings = make_settings(SKIP_STARTUP_ENV_VALIDATION=True)

    with pytest.raises(RuntimeError):
        settings.validate_required_runtime_config()


def test_partial_config_lists_only_missing_runtime_env(monkeypatch):
    monkeypatch.delenv("TESTING", raising=False)
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    settings = make_settings(
        MONGO_URL="mongodb://example",
        REDIS_URL="redis://cache.invalid:6379/0",
    )

    with pytest.raises(RuntimeError) as exc_info:
        settings.validate_required_runtime_config()

    message = str(exc_info.value)
    assert "MONGO_URL" not in message
    assert "REDIS_URL" not in message
    assert "AUTH_OTP_PEPPER" in message
    assert "DATABASE_URL" in message


def test_admin_seed_env_stays_optional(monkeypatch):
    monkeypatch.delenv("TESTING", raising=False)
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    settings = make_settings(
        MONGO_URL="mongodb://example",
        REDIS_URL="redis://cache.invalid:6379/0",
        AUTH_OTP_PEPPER=SecretStr("test-only-pepper"),
        DATABASE_URL="postgresql://postgres:db-password@example/postgres",
        DEFAULT_ADMIN_EMAIL="",
        DEFAULT_ADMIN_PASSWORD="",
    )

    settings.validate_required_runtime_config()
