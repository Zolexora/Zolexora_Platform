"""Unit tests for auth pooling, LRU caches, non-commander RBAC, RLS bypass, and bootstrap."""
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.auth import dependencies, zolexora
from app.core.config import settings
from app.main import app
from app.modules.core.platform import admin_routes
from app.modules.identity.roles.models import OverrideType


class _DummyScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value

    def scalar(self):
        return self._value

    def scalars(self):
        return self

    def all(self):
        return self._value if isinstance(self._value, list) else ([] if self._value is None else [self._value])

    def first(self):
        if isinstance(self._value, list):
            return self._value[0] if self._value else None
        return self._value


@pytest.fixture(autouse=True)
def _reset_caches():
    zolexora._cache.clear()
    dependencies._known_profiles.clear()
    yield
    zolexora._cache.clear()
    dependencies._known_profiles.clear()


async def test_introspect_reuses_persistent_client_and_lru_evicts(monkeypatch):
    created_clients = []
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        tok = request.headers["Authorization"].removeprefix("Bearer ")
        calls.append(tok)
        return httpx.Response(200, json={"user": {"uid": str(uuid.uuid4())}})

    real_client = httpx.AsyncClient

    def fake_client(**kw):
        c = real_client(transport=httpx.MockTransport(handler), **kw)
        created_clients.append(c)
        return c

    monkeypatch.setattr(zolexora.httpx, "AsyncClient", fake_client)
    monkeypatch.setattr(zolexora, "_CACHE_MAX", 2)
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "AUTH_SERVICE_URL", "https://auth.example")

    await zolexora.introspect("t1")
    await zolexora.introspect("t2")
    await zolexora.introspect("t1")  # promotes t1 as MRU
    await zolexora.introspect("t3")  # evicts t2, keeps t1 & t3

    assert len(created_clients) == 1, "should reuse one persistent AsyncClient"
    assert calls == ["t1", "t2", "t3"]

    # t1 must still be cached; t2 was evicted
    await zolexora.introspect("t1")
    assert calls == ["t1", "t2", "t3"]
    await zolexora.introspect("t2")
    assert calls == ["t1", "t2", "t3", "t2"]

    await zolexora.close_client()


async def test_require_permission_resolves_non_commander_role_and_overrides(monkeypatch):
    org_id = uuid.uuid4()
    member_id = uuid.uuid4()
    user_id = uuid.uuid4()

    assignment = SimpleNamespace(
        role=SimpleNamespace(name="Ops Lead"),
        role_version=SimpleNamespace(
            permissions=[
                SimpleNamespace(module_code="identity", page_code="users", action_code="manage"),
                SimpleNamespace(module_code="fleet", page_code="vehicles", action_code="view"),
            ]
        ),
    )
    overrides = [
        SimpleNamespace(
            override_type=OverrideType.GRANT,
            module_code="operations",
            page_code="dispatch",
            action_code="assign",
        ),
        SimpleNamespace(
            override_type=OverrideType.RESTRICT,
            module_code="fleet",
            page_code="vehicles",
            action_code="view",
        ),
    ]

    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _DummyScalarResult(assignment),
            _DummyScalarResult(overrides),
        ]
    )

    user = dependencies.AuthenticatedUser(
        id=user_id,
        organisation_id=org_id,
        member_id=member_id,
        is_commander=False,
    )

    # Allow both canonical and alias permission checks
    dep_manage = dependencies.require_permission("users.manage")
    resolved = await dep_manage(user=user, db=db)
    assert resolved.role_code == "Ops Lead"
    assert resolved.has_permission("identity.users.manage") is True
    assert resolved.has_permission("operations.dispatch.assign") is True
    assert resolved.has_permission("fleet.vehicles.view") is False

    dep_restricted = dependencies.require_permission("fleet.vehicles.view")
    with pytest.raises(HTTPException) as exc:
        await dep_restricted(user=resolved, db=db)
    assert exc.value.status_code == 403


async def test_admin_stats_uses_rls_bypass(monkeypatch):
    bypass_events = []

    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def fake_rls_bypass(db):
        bypass_events.append("enter")
        yield
        bypass_events.append("exit")

    monkeypatch.setattr(admin_routes, "rls_bypass", fake_rls_bypass)

    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _DummyScalarResult(5),
            _DummyScalarResult(4),
            _DummyScalarResult(1),
            _DummyScalarResult(12),
        ]
    )
    admin = dependencies.AuthenticatedIdentity(id=uuid.uuid4(), is_platform_admin=True)
    res = await admin_routes.get_platform_stats(db=db, admin=admin)
    assert res.total_tenants == 5
    assert res.total_members == 12
    assert bypass_events == ["enter", "exit"]


async def test_bootstrap_endpoint_returns_single_payload(monkeypatch):
    from app.modules.identity.users import routes as user_routes

    org_id = uuid.uuid4()
    uid = uuid.uuid4()
    member_id = uuid.uuid4()

    async def fake_identity(token: str):
        return dependencies.AuthenticatedIdentity(id=uid, email="boss@fleet.test", full_name="Boss")

    monkeypatch.setattr(user_routes, "ensure_profile", AsyncMock())
    monkeypatch.setattr(
        user_routes,
        "resolve_membership",
        AsyncMock(return_value={
            "member_id": member_id,
            "organisation_id": org_id,
            "workspace_type": "SERVICE_PROVIDER",
            "is_creator": True,
            "is_commander": True,
        }),
    )
    monkeypatch.setattr(user_routes, "set_tenant_context", AsyncMock())
    monkeypatch.setattr(
        user_routes.ApplicationRuntimeService,
        "get_runtime_configuration",
        AsyncMock(side_effect=HTTPException(status_code=404, detail="not configured")),
    )

    fake_org = SimpleNamespace(
        id=org_id,
        name="Alpha Fleet",
        organisation_type="Startup",
        workspace_type="SERVICE_PROVIDER",
        status="ACTIVE",
        created_at="2026-01-01T00:00:00Z",
        updated_at="2026-01-01T00:00:00Z",
    )
    fake_db = AsyncMock()
    fake_db.execute = AsyncMock(return_value=_DummyScalarResult(fake_org))

    app.dependency_overrides[dependencies.get_current_identity] = lambda: dependencies.AuthenticatedIdentity(
        id=uid, email="boss@fleet.test", full_name="Boss"
    )
    app.dependency_overrides[user_routes.get_db] = lambda: fake_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.get("/api/v1/auth/bootstrap")
        assert res.status_code == 200
        body = res.json()
        assert body["me"]["organisation_id"] == str(org_id)
        assert body["organisation"]["name"] == "Alpha Fleet"
        assert body["effective_permissions"]["is_commander"] is True
        assert "identity.users.manage" in body["effective_permissions"]["permissions"]
        assert body["runtime"] is None
    finally:
        app.dependency_overrides.clear()
