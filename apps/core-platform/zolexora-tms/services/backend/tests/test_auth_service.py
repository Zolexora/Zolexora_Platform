"""Token checks go through the Zolexora auth service (/api/v1/auth/me)."""
import httpx
import pytest
from fastapi import HTTPException

from app.auth import zolexora
from app.auth.dependencies import identity_from_token, require_platform_admin
from app.core.config import settings

UID = "7b3f6a52-2f1e-4f7e-9a4f-1d2c3b4a5e6f"


@pytest.fixture
def auth_service(monkeypatch):
    """Production path with a fake auth service; returns the list of tokens it saw."""
    class Seen(list):
        responses: dict[str, httpx.Response]

    seen = Seen()
    seen.responses = responses = {}

    def handler(request: httpx.Request) -> httpx.Response:
        token = request.headers["Authorization"].removeprefix("Bearer ")
        seen.append(token)
        return responses.get(token, httpx.Response(401, json={"error": "invalid"}))

    real = httpx.AsyncClient
    monkeypatch.setattr(zolexora.httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "AUTH_SERVICE_URL", "https://auth.example")
    zolexora._cache.clear()
    return seen


def _ok(**user):
    return httpx.Response(200, json={"authenticated": True, "user": {"uid": UID, **user}})


async def test_valid_token_is_cached(auth_service):
    auth_service.responses["good"] = _ok(email="a@b.co", org_id="ZX-ORG-1", is_platform_admin=False)
    ident = await identity_from_token("good")
    await identity_from_token("good")
    assert str(ident.id) == UID and ident.zolexora_org_id == "ZX-ORG-1" and not ident.is_platform_admin
    assert auth_service == ["good"]


async def test_rejected_token_is_401(auth_service):
    with pytest.raises(HTTPException) as e:
        await identity_from_token("bad")
    assert e.value.status_code == 401


async def test_auth_service_down_is_503(auth_service):
    auth_service.responses["x"] = httpx.Response(500)
    with pytest.raises(HTTPException) as e:
        await identity_from_token("x")
    assert e.value.status_code == 503


async def test_missing_auth_service_url_is_503(auth_service, monkeypatch):
    monkeypatch.setattr(settings, "AUTH_SERVICE_URL", None)
    with pytest.raises(HTTPException) as e:
        await identity_from_token("good")
    assert e.value.status_code == 503


async def test_platform_admin_comes_from_auth_service(auth_service):
    auth_service.responses["admin"] = _ok(is_platform_admin=True)
    auth_service.responses["user"] = _ok(is_platform_admin=False)
    assert (await require_platform_admin(await identity_from_token("admin"))).is_platform_admin
    with pytest.raises(HTTPException) as e:
        await require_platform_admin(await identity_from_token("user"))
    assert e.value.status_code == 403


def test_docker_url_swap(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_SERVICE_URL", "http://localhost:3081/")
    monkeypatch.setattr(settings, "TMS_IN_DOCKER", True)
    assert zolexora.auth_service_url() == "http://host.docker.internal:3081"
    monkeypatch.setattr(settings, "TMS_IN_DOCKER", False)
    assert zolexora.auth_service_url() == "http://localhost:3081"
