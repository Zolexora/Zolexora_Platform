"""Employee (ZX-ORG) and platform-admin access as issued by the Zolexora auth service."""
import uuid

from httpx import ASGITransport, AsyncClient
from jose import jwt

from app.core.config import settings
from app.main import app


def token(uid: uuid.UUID, email: str, **claims) -> str:
    return jwt.encode({"uid": str(uid), "email": email, **claims}, settings.JWT_SECRET, algorithm="HS256")


def auth(t: str) -> dict:
    return {"Authorization": f"Bearer {t}"}


async def test_employee_joins_linked_workspace_and_admin_links_it():
    zx_org = f"ZX-ORG-{uuid.uuid4().hex[:4].upper()}-TEST-0001"
    owner, admin, employee = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/onboarding",
            json={"name": "Linked Fleet", "organisation_type": "Private Limited Company"},
            headers=auth(token(owner, "owner@fleet.test")),
        )
        assert res.status_code == 201
        org_id = res.json()["organisation"]["id"]

        emp = auth(token(employee, "driver@fleet.test", org_id=zx_org))
        # Not linked yet: no workspace, and employees can't create one
        me = await client.get("/api/v1/auth/me", headers=emp)
        assert me.status_code == 200 and me.json()["organisation_id"] is None
        assert me.json()["zolexora_org_id"] == zx_org
        assert (await client.get("/api/v1/organisations/me", headers=emp)).status_code == 403
        res = await client.post("/api/v1/onboarding", json={"name": "Nope", "organisation_type": "Startup"}, headers=emp)
        assert res.status_code == 403

        # Only platform admins (auth-service flag) can link
        link = f"/api/v1/admin/organisations/{org_id}/zolexora-org"
        res = await client.put(link, json={"zolexora_org_id": zx_org}, headers=auth(token(owner, "owner@fleet.test")))
        assert res.status_code == 403
        res = await client.put(
            link,
            json={"zolexora_org_id": zx_org},
            headers=auth(token(admin, "admin@zolexora.test", is_platform_admin=True)),
        )
        assert res.status_code == 200

        # Employee now lands in the linked workspace, whatever X-Organization-Id says
        me = await client.get("/api/v1/auth/me", headers={**emp, "X-Organization-Id": str(uuid.uuid4())})
        assert me.json()["organisation_id"] == org_id
        assert me.json()["is_commander"] is False
        assert (await client.get("/api/v1/organisations/me", headers=emp)).json()["id"] == org_id


async def test_invalid_or_missing_token_is_401():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.get("/api/v1/auth/me", headers=auth("not-a-token"))).status_code == 401
        assert (await client.get("/api/v1/auth/me")).status_code == 401
