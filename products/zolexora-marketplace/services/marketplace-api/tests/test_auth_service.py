"""Sign-in through the Zolexora auth service: token checks and profile mapping."""

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from starlette.requests import Request

import core.auth_service as auth_service
import core.deps as deps
from core.config import settings

BUYER = {
    "uid": "0b8f2c3e-1111-4222-8333-444455556666", "email": "asha@example.com", "email_verified": True,
    "display_name": "Asha Rao", "phone_number": "+919800000001", "phone_verified": True,
}


def _request() -> Request:
    return Request({"type": "http", "method": "GET", "path": "/", "headers": []})


def _bearer(token: str = "token") -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


class Repo:
    def __init__(self, status: str = "active"):
        self.status = status
        self.synced: list[dict] = []

    async def sync_identity(self, identity: dict) -> dict:
        self.synced.append(identity)
        return {"id": identity["uid"], "email": identity["email"],
                "is_active": self.status == "active", "status": self.status}


def _identity(monkeypatch, value=None, error=None):
    async def fake(token):
        assert token == "token"
        if error:
            raise error
        return value

    monkeypatch.setattr(deps, "introspect", fake)


@pytest.mark.asyncio
async def test_missing_token_is_401():
    with pytest.raises(HTTPException) as exc:
        await deps.current_user(_request(), None, Repo())
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_rejected_token_is_401(monkeypatch):
    _identity(monkeypatch, error=auth_service.InvalidToken("bad"))
    with pytest.raises(HTTPException) as exc:
        await deps.current_user(_request(), _bearer(), Repo())
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_auth_service_down_is_503(monkeypatch):
    _identity(monkeypatch, error=auth_service.AuthServiceError("down"))
    with pytest.raises(HTTPException) as exc:
        await deps.current_user(_request(), _bearer(), Repo())
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_public_user_gets_marketplace_profile(monkeypatch):
    _identity(monkeypatch, BUYER)
    repo = Repo()
    user = await deps.current_user(_request(), _bearer(), repo)
    assert user["id"] == BUYER["uid"] and not deps.is_admin(user)
    assert repo.synced == [BUYER]


@pytest.mark.asyncio
async def test_suspended_marketplace_profile_is_403(monkeypatch):
    _identity(monkeypatch, BUYER)
    with pytest.raises(HTTPException) as exc:
        await deps.current_user(_request(), _bearer(), Repo(status="suspended"))
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_platform_admin_is_marketplace_admin_without_profile(monkeypatch):
    _identity(monkeypatch, {"uid": "a-1", "email": "ops@zolexora.com", "is_platform_admin": True,
                            "role": "admin", "permissions": ["users:read"]})
    repo = Repo()
    user = await deps.current_user(_request(), _bearer(), repo)
    assert deps.is_admin(user) and user["permissions"] == ["users:read"]
    assert repo.synced == []


@pytest.mark.asyncio
@pytest.mark.parametrize("identity", [
    {**BUYER, "email_verified": False},
])
async def test_unverified_accounts_are_refused(monkeypatch, identity):
    _identity(monkeypatch, identity)
    with pytest.raises(HTTPException) as exc:
        await deps.current_user(_request(), _bearer(), Repo())
    assert exc.value.status_code == 403


class FakeClient:
    calls = 0
    status = 200

    def __init__(self, **_):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return False

    async def get(self, url, headers):
        FakeClient.calls += 1
        assert url == "http://localhost:4000/api/v1/auth/me"
        assert headers == {"Authorization": "Bearer tok"}
        import httpx
        return httpx.Response(FakeClient.status, json={"user": BUYER} if FakeClient.status == 200 else {})


@pytest.fixture
def auth_http(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_SERVICE_URL", "http://localhost:4000/")
    monkeypatch.setattr(settings, "MARKETPLACE_IN_DOCKER", False)
    monkeypatch.setattr(auth_service.httpx, "AsyncClient", FakeClient)
    auth_service._cache.clear()
    FakeClient.calls, FakeClient.status = 0, 200
    yield
    auth_service._cache.clear()


@pytest.mark.asyncio
async def test_introspect_caches_the_auth_service_answer(auth_http):
    assert await auth_service.introspect("tok") == BUYER
    assert await auth_service.introspect("tok") == BUYER
    assert FakeClient.calls == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("status,error", [(401, auth_service.InvalidToken), (500, auth_service.AuthServiceError)])
async def test_introspect_maps_auth_service_errors(auth_http, status, error):
    FakeClient.status = status
    with pytest.raises(error):
        await auth_service.introspect("tok")


def test_docker_swaps_localhost(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_SERVICE_URL", "http://localhost:4000")
    monkeypatch.setattr(settings, "MARKETPLACE_IN_DOCKER", True)
    assert auth_service.auth_service_url() == "http://host.docker.internal:4000"


@pytest.mark.asyncio
async def test_employee_tokens_act_only_for_their_linked_seller_organisation(monkeypatch):
    """Track 2 staff: the auth service vouches for the ZX-ORG; the seller org is the one linked to it."""
    seen = {}

    async def employee(identity, repo):
        seen["org"] = identity["org_id"]
        return {"id": "e-1", "role": "seller", "seller_org_id": "org-a"}

    async def introspect(token):
        return {"uid": "e-1", "email": "staff@acme.com", "org_id": "ZX-ORG-AAAA-BBBB-CCCC", "role": "member"}

    monkeypatch.setattr(deps, "introspect", introspect)
    monkeypatch.setattr(deps, "_employee", employee)
    user = await deps.current_user(_request(), _bearer(), Repo())
    assert seen["org"] == "ZX-ORG-AAAA-BBBB-CCCC"
    assert user["seller_org_id"] == "org-a" and "requested_org_id" not in user
