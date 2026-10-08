import asyncio
import json
import os
import subprocess
import uuid
from dataclasses import dataclass
from pathlib import Path

import asyncpg
import pytest
from alembic import command
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from auth import services
from auth.schemas import RegisterRequest
from core.security import hash_password, password_hash_needs_upgrade, verify_password
from main import app
from scripts.migrate_supabase_identities import map_export
from shared.database import postgres, redis as redis_store
from users.repositories import UserRepository

ROOT = Path(__file__).parents[3]
API = ROOT / "services/marketplace-api"
COMPOSE = ROOT / "infrastructure/docker/postgres-test.compose.yml"
TEST_URL = "postgresql://marketplace_local:marketplace-local-only@127.0.0.1:5432/marketplace_local"


@dataclass(frozen=True)
class MigrationResult:
    at_0001: str
    head: str
    first: tuple
    second: tuple


async def _reset_database() -> None:
    connection = await asyncpg.connect(TEST_URL)
    try:
        await connection.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public")
    finally:
        await connection.close()


async def _fingerprint() -> tuple:
    connection = await asyncpg.connect(TEST_URL)
    try:
        return (
            tuple(await connection.fetchval("SELECT array_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname='public'")),
            tuple(await connection.fetchval("SELECT array_agg(conname ORDER BY conname) FROM pg_constraint WHERE connamespace='public'::regnamespace")),
            tuple(await connection.fetchval("SELECT array_agg(indexname ORDER BY indexname) FROM pg_indexes WHERE schemaname='public'")),
            await connection.fetchval("SELECT version_num FROM alembic_version"),
        )
    finally:
        await connection.close()


@pytest.fixture(scope="module")
def migrated_database() -> MigrationResult:
    subprocess.run(["docker", "compose", "-f", str(COMPOSE), "up", "-d", "--wait"], check=True, cwd=ROOT)
    os.environ["DATABASE_URL"] = TEST_URL
    asyncio.run(_reset_database())
    config = Config(str(API / "alembic.ini"))
    command.upgrade(config, "0001_postgresql_foundation")
    at_0001 = asyncio.run(_fingerprint())[3]
    command.upgrade(config, "head")
    first = asyncio.run(_fingerprint())
    command.upgrade(config, "head")
    second = asyncio.run(_fingerprint())
    return MigrationResult(at_0001, first[3], first, second)


@pytest.fixture
async def runtime(migrated_database):
    await postgres.init_pool()
    redis_store.init_redis()
    await redis_store.get_redis().flushdb()
    async with postgres.connection() as connection:
        await connection.execute("TRUNCATE users CASCADE")
    try:
        yield UserRepository()
    finally:
        await redis_store.close_redis()
        await postgres.close_pool()


def test_0001_upgrades_to_identity_head(migrated_database):
    assert migrated_database.at_0001 == "0001_postgresql_foundation"
    assert migrated_database.head == "0010_erp_outbox_inbox"



def test_second_upgrade_to_head_is_noop(migrated_database):
    assert migrated_database.first == migrated_database.second


def test_identity_tables_constraints_and_indexes_exist(migrated_database):
    tables, constraints, indexes, _head = migrated_database.first
    assert {"user_profile", "role", "permission", "user_role", "role_permission"} <= set(tables)
    assert {"uq_user_profile_user", "uq_user_role_user", "ck_role_role_key_values", "ck_users_users_auth_version_positive"} <= set(constraints)
    assert {"ix_user_role_role_user", "ix_role_permission_permission_role"} <= set(indexes)


@pytest.mark.asyncio
async def test_role_bootstrap_is_deterministic(migrated_database):
    connection = await asyncpg.connect(TEST_URL)
    try:
        assert [row["role_key"] for row in await connection.fetch("SELECT role_key FROM role ORDER BY role_key")] == [
            "admin", "buyer", "seller",
        ]
        assert await connection.fetchval("SELECT count(*) FROM role_permission") == 3
    finally:
        await connection.close()


@pytest.mark.asyncio
async def test_identity_transaction_creates_user_profile_and_buyer_role(runtime):
    user = await runtime.create_identity(
        email="buyer@example.invalid", name="Buyer", password_hash=hash_password("password-1"),
    )
    assert user["role"] == "buyer" and user["is_email_verified"] is True
    async with postgres.connection() as connection:
        assert await connection.fetchval("SELECT count(*) FROM user_profile WHERE user_id=$1", uuid.UUID(user["id"])) == 1


@pytest.mark.asyncio
async def test_duplicate_normalized_email_is_rejected(runtime):
    await runtime.create_identity(email="buyer@example.invalid", name="Buyer", password_hash=None)
    with pytest.raises(asyncpg.UniqueViolationError):
        await runtime.create_identity(email="buyer@example.invalid", name="Other", password_hash=None)


@pytest.mark.asyncio
async def test_uppercase_email_is_rejected_by_database(runtime):
    async with postgres.connection() as connection:
        with pytest.raises(asyncpg.CheckViolationError):
            await connection.execute("INSERT INTO users (id,email) VALUES ($1,'Upper@Example.invalid')", uuid.uuid4())


@pytest.mark.asyncio
async def test_invalid_or_duplicate_role_assignment_fails(runtime):
    user = await runtime.create_identity(email="buyer@example.invalid", name="Buyer", password_hash=None)
    async with postgres.connection() as connection:
        with pytest.raises(asyncpg.UniqueViolationError):
            await connection.execute(
                "INSERT INTO user_role (id,user_id,role_id) SELECT $1,$2,id FROM role WHERE role_key='seller'",
                uuid.uuid4(), uuid.UUID(user["id"]),
            )


def test_argon2id_credentials_and_generic_upgrade_check():
    password_hash = hash_password("correct-password-1")
    assert password_hash.startswith("$argon2id$")
    assert verify_password("correct-password-1", password_hash)
    assert not verify_password("wrong-password-1", password_hash)
    assert password_hash_needs_upgrade(password_hash) is False


@pytest.mark.parametrize("field", ["role", "seller_id", "storefront_id", "auth_version"])
def test_registration_cannot_request_authority(field):
    with pytest.raises(ValidationError):
        RegisterRequest.model_validate({"email": "buyer@example.invalid", "password": "password-1", "name": "Buyer", field: "admin"})


@pytest.mark.asyncio
async def test_real_redis_session_is_opaque_digested_and_revocable(runtime):
    token, csrf, record = await redis_store.create_session(str(uuid.uuid4()), 1)
    keys = await redis_store.get_redis().keys("*")
    values = await redis_store.get_redis().mget(keys)
    assert len(token) >= 64 and token not in "".join(keys + [value or "" for value in values])
    assert await redis_store.get_session(token) == record
    assert await redis_store.validate_csrf(token, csrf)
    await redis_store.revoke_session(token)
    assert await redis_store.get_session(token) is None


@pytest.mark.asyncio
async def test_revoke_all_sessions_is_user_scoped(runtime):
    user_id = str(uuid.uuid4())
    first, _csrf, _record = await redis_store.create_session(user_id, 1)
    second, _csrf, _record = await redis_store.create_session(user_id, 1)
    other, _csrf, _record = await redis_store.create_session(str(uuid.uuid4()), 1)
    assert await redis_store.revoke_all_user_sessions(user_id) == 2
    assert await redis_store.get_session(first) is None and await redis_store.get_session(second) is None
    assert await redis_store.get_session(other) is not None


@pytest.mark.asyncio
async def test_absent_session_and_idempotent_revocation_are_safe(runtime):
    assert await redis_store.get_session("absent") is None
    await redis_store.revoke_session("absent")


@pytest.mark.asyncio
async def test_real_redis_session_expires_server_side(runtime, monkeypatch):
    monkeypatch.setattr(redis_store.settings, "SESSION_TTL_SECONDS", 1)
    token, _csrf, _record = await redis_store.create_session(str(uuid.uuid4()), 1)
    await asyncio.sleep(1.1)
    assert await redis_store.get_session(token) is None


@pytest.mark.asyncio
async def test_registration_otp_is_digested_single_use(runtime, monkeypatch):
    delivered = []

    async def capture(destination, secret, purpose):
        delivered.append((destination, secret, purpose))

    monkeypatch.setattr(services, "deliver_secret", capture)
    await services.initiate_registration("new@example.invalid", "New User", "password-1", runtime)
    otp = delivered[0][1]
    keys = await redis_store.get_redis().keys("*:pending:*")
    values = await redis_store.get_redis().hvals(keys[0])
    assert otp not in values
    user = await services.complete_registration("new@example.invalid", otp, runtime)
    assert user["role"] == "buyer"
    with pytest.raises(Exception):
        await services.complete_registration("new@example.invalid", otp, runtime)


@pytest.mark.asyncio
async def test_concurrent_otp_verification_creates_at_most_one_identity(runtime, monkeypatch):
    delivered = []

    async def capture(_destination, secret, _purpose):
        delivered.append(secret)

    monkeypatch.setattr(services, "deliver_secret", capture)
    await services.initiate_registration("new@example.invalid", "New User", "password-1", runtime)
    results = await asyncio.gather(
        services.complete_registration("new@example.invalid", delivered[0], runtime),
        services.complete_registration("new@example.invalid", delivered[0], runtime),
        return_exceptions=True,
    )
    assert sum(isinstance(result, dict) for result in results) == 1
    assert await runtime.count_users() == 1


@pytest.mark.asyncio
async def test_incorrect_otp_attempt_limit_invalidates_challenge(runtime, monkeypatch):
    async def capture(_destination, _secret, _purpose):
        return None

    monkeypatch.setattr(services, "deliver_secret", capture)
    await services.initiate_registration("new@example.invalid", "New User", "password-1", runtime)
    for _ in range(redis_store.OTP_ATTEMPT_LIMIT):
        status, _pending = await redis_store.consume_registration("new@example.invalid", "000000")
    assert status == "invalid"
    assert await redis_store.pending_registration_ttl("new@example.invalid") == -2


@pytest.mark.asyncio
async def test_pending_registration_expires(runtime, monkeypatch):
    monkeypatch.setattr(redis_store.settings, "OTP_TTL_SECONDS", 1)
    assert await redis_store.begin_registration("new@example.invalid", {"name": "New", "password_hash": "hash"}, "123456")
    await asyncio.sleep(1.1)
    status, pending = await redis_store.consume_registration("new@example.invalid", "123456")
    assert status == "expired" and pending is None


@pytest.mark.asyncio
async def test_resend_cooldown_is_enforced(runtime):
    assert await redis_store.begin_registration("new@example.invalid", {"name": "New", "password_hash": "hash"}, "123456")
    assert not await redis_store.resend_registration("new@example.invalid", "654321")


@pytest.mark.asyncio
async def test_registration_rate_limit_is_bounded(runtime, monkeypatch):
    monkeypatch.setattr(redis_store.settings, "REGISTRATION_RATE_LIMIT", 1)
    assert await redis_store.begin_registration("new@example.invalid", {"name": "New", "password_hash": "hash"}, "123456")
    assert not await redis_store.begin_registration("new@example.invalid", {"name": "New", "password_hash": "hash"}, "123456")


@pytest.mark.asyncio
async def test_failed_verification_creates_no_postgres_identity(runtime):
    with pytest.raises(Exception):
        await services.complete_registration("missing@example.invalid", "123456", runtime)
    assert await runtime.count_users() == 0


@pytest.mark.asyncio
async def test_login_cookie_attributes_and_no_browser_token(runtime):
    await runtime.create_identity(
        email="buyer@example.invalid", name="Buyer", password_hash=hash_password("password-1"),
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://shop.zolexora.com") as client:
        response = await client.post("/api/auth/login", json={"email": "buyer@example.invalid", "password": "password-1"})
    cookies = response.headers.get_list("set-cookie")
    assert response.status_code == 200 and response.json()["session_token"] is None
    assert any("z_session=" in value and "HttpOnly" in value and "Secure" in value and "Path=/" in value for value in cookies)
    assert any("SameSite=lax" in value for value in cookies)


@pytest.mark.asyncio
async def test_native_login_returns_new_opaque_token(runtime):
    await runtime.create_identity(
        email="buyer@example.invalid", name="Buyer", password_hash=hash_password("password-1"),
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://native.invalid") as client:
        first = await client.post("/api/auth/login", headers={"X-Session-Transport": "native"}, json={"email": "buyer@example.invalid", "password": "password-1"})
        second = await client.post("/api/auth/login", headers={"X-Session-Transport": "native", "Authorization": "Bearer attacker-value"}, json={"email": "buyer@example.invalid", "password": "password-1"})
    assert first.status_code == second.status_code == 200
    assert first.json()["session_token"] != second.json()["session_token"] != "attacker-value"


@pytest.mark.asyncio
async def test_login_failure_is_generic_for_unknown_and_wrong_password(runtime):
    await runtime.create_identity(
        email="buyer@example.invalid", name="Buyer", password_hash=hash_password("password-1"),
    )
    with pytest.raises(Exception) as wrong:
        await services.login_with_password("buyer@example.invalid", "wrong-password-1", runtime)
    with pytest.raises(Exception) as unknown:
        await services.login_with_password("unknown@example.invalid", "wrong-password-1", runtime)
    assert str(wrong.value) == str(unknown.value)


@pytest.mark.asyncio
async def test_disabled_user_and_role_change_invalidate_existing_session(runtime):
    user = await runtime.create_identity(email="buyer@example.invalid", name="Buyer", password_hash=None)
    token, _csrf, _record = await redis_store.create_session(user["id"], 1)
    await runtime.set_role(user["id"], "seller")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://native.invalid") as client:
        role_changed = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert role_changed.status_code == 401
    token, _csrf, _record = await redis_store.create_session(user["id"], 2)
    await runtime.set_active(user["id"], False)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://native.invalid") as client:
        disabled = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert disabled.status_code == 401


@pytest.mark.asyncio
async def test_cookie_unsafe_request_requires_valid_csrf(runtime):
    await runtime.create_identity(email="buyer@example.invalid", name="Buyer", password_hash=hash_password("password-1"))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://shop.zolexora.com") as client:
        await client.post("/api/auth/login", json={"email": "buyer@example.invalid", "password": "password-1"})
        rejected = await client.post("/api/auth/revoke-all", headers={"Origin": "https://shop.zolexora.com"})
        csrf = client.cookies.get("z_csrf")
        accepted = await client.post("/api/auth/revoke-all", headers={"Origin": "https://shop.zolexora.com", "X-CSRF-Token": csrf})
    assert rejected.status_code == 403 and accepted.status_code == 200


@pytest.mark.asyncio
async def test_logout_revokes_session_is_idempotent_and_clears_matching_cookie(runtime):
    await runtime.create_identity(email="buyer@example.invalid", name="Buyer", password_hash=hash_password("password-1"))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://shop.zolexora.com") as client:
        await client.post("/api/auth/login", json={"email": "buyer@example.invalid", "password": "password-1"})
        csrf = client.cookies.get("z_csrf")
        first = await client.post("/api/auth/logout", headers={"Origin": "https://shop.zolexora.com", "X-CSRF-Token": csrf})
        second = await client.post("/api/auth/logout")
    assert first.status_code == second.status_code == 200
    assert any("z_session=" in value and "Max-Age=0" in value and "Path=/" in value for value in first.headers.get_list("set-cookie"))


@pytest.mark.asyncio
async def test_current_user_response_excludes_credentials_and_session_metadata(runtime):
    user = await runtime.create_identity(email="buyer@example.invalid", name="Buyer", password_hash=hash_password("password-1"))
    token, _csrf, _record = await redis_store.create_session(user["id"], 1)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://native.invalid") as client:
        response = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    body = response.json()
    assert response.status_code == 200
    assert not {"password_hash", "auth_version", "session_id", "csrf_digest"} & body.keys()


@pytest.mark.asyncio
async def test_redis_failure_fails_authentication_closed_without_connection_details(runtime, monkeypatch):
    import core.deps as deps

    async def unavailable(_token):
        raise RuntimeError("redis://credential@internal.invalid")

    monkeypatch.setattr(deps, "get_session", unavailable)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://native.invalid") as client:
        response = await client.get("/api/auth/me", headers={"Authorization": "Bearer opaque"})
    assert response.status_code == 503
    assert "redis://" not in response.text and "credential" not in response.text


@pytest.mark.asyncio
async def test_untrusted_origin_and_ambiguous_credentials_fail(runtime):
    user = await runtime.create_identity(email="buyer@example.invalid", name="Buyer", password_hash=None)
    token, csrf, _record = await redis_store.create_session(user["id"], 1)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://shop.zolexora.com") as client:
        client.cookies.set("z_session", token)
        client.cookies.set("z_csrf", csrf)
        origin = await client.post("/api/auth/revoke-all", headers={"Origin": "https://evil.invalid", "X-CSRF-Token": csrf})
        ambiguous = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert origin.status_code == 403 and ambiguous.status_code == 400


@pytest.mark.asyncio
async def test_readiness_requires_current_postgres_and_real_redis(runtime):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready", "database": True, "redis": True}


@pytest.mark.asyncio
async def test_readiness_fails_safely_when_redis_is_unavailable(runtime, monkeypatch):
    async def unavailable():
        return False

    monkeypatch.setattr(redis_store, "check_redis_connection", unavailable)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/ready")
    assert response.status_code == 503
    assert "redis://" not in response.text and "password" not in response.text


def _export() -> dict:
    return {
        "auth_users": [
            {"id": "00000000-0000-4000-4100-000000000010", "email": "One@Example.invalid", "email_confirmed_at": "2026-01-01"},
            {"id": "legacy-id", "email": "two@example.invalid"},
        ],
        "public_users": [
            {"id": "00000000-0000-4000-4100-000000000010", "name": "One", "role": "viewer"},
            {"id": "legacy-id", "name": "Two", "role": "viewer"},
        ],
    }


def test_offline_identity_mapping_is_deterministic_and_preserves_valid_uuid():
    first = map_export(_export())
    second = map_export(json.loads(json.dumps(_export())))
    assert first == second
    assert first["mapped"][0]["user_id"] == "00000000-0000-4000-4100-000000000010"
    assert uuid.UUID(first["mapped"][1]["user_id"]) == uuid.UUID(map_export(_export())["mapped"][1]["user_id"])


@pytest.mark.parametrize(
    ("role", "reason"),
    [("root", "unknown_role"), ("admin", "privileged_role_requires_approval"), ("seller", "privileged_role_requires_approval")],
)
def test_offline_identity_mapping_rejects_unapproved_roles(role, reason):
    source = _export()
    source["public_users"][0]["role"] = role
    assert map_export(source)["rejected"][0]["reason"] == reason


def test_offline_identity_mapping_reports_duplicate_without_sensitive_fields():
    source = _export()
    source["auth_users"][1]["email"] = "one@example.invalid"
    source["auth_users"][1]["access_token"] = "must-not-appear"
    result = map_export(source)
    assert result["rejected"][0]["reason"] == "duplicate_email"
    assert "must-not-appear" not in json.dumps(result)


def test_public_identity_contracts_exclude_authority_and_internal_secrets():
    schema = app.openapi()
    components = schema["components"]["schemas"]
    register = components["RegisterRequest"]["properties"]
    auth = components["AuthResponse"]["properties"]
    user = components["UserPublic"]["properties"]
    assert not {"role", "seller_id", "storefront_id", "auth_version"} & register.keys()
    assert not {"password_hash", "otp", "csrf_digest", "session_id"} & (auth.keys() | user.keys())
    assert "/api/auth/google-login" not in schema["paths"]
    assert register["password"]["minLength"] == 8 and register["password"]["maxLength"] == 256
