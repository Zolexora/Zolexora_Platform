"""Mobile bootstrap and caller-linked Driver / Vendor resolution."""
import uuid

from httpx import ASGITransport, AsyncClient
from jose import jwt

from app.core.config import settings
from app.main import app


def token(uid: uuid.UUID, email: str | None, **claims) -> str:
    payload = {"uid": str(uid), **claims}
    if email is not None:
        payload["email"] = email
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def auth(t: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {t}"}


async def test_mobile_bootstrap_and_vendor_driver_me():
    zx_org = f"ZX-ORG-{uuid.uuid4().hex[:4].upper()}-MOBL-0001"
    owner_uid = uuid.uuid4()
    admin_uid = uuid.uuid4()
    driver_uid = uuid.uuid4()
    vendor_uid = uuid.uuid4()
    combo_uid = uuid.uuid4()
    phone_driver_uid = uuid.uuid4()

    owner_headers = auth(token(owner_uid, f"owner-{uuid.uuid4().hex[:6]}@mob.test"))
    admin_headers = auth(token(admin_uid, "admin@zolexora.test", is_platform_admin=True))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        onboard = await client.post(
            "/api/v1/onboarding",
            json={"name": "Mobile Fleet Ops", "organisation_type": "Private Limited Company"},
            headers=owner_headers,
        )
        assert onboard.status_code == 201
        org_id = onboard.json()["organisation"]["id"]

        link = await client.put(
            f"/api/v1/admin/organisations/{org_id}/zolexora-org",
            json={"zolexora_org_id": zx_org},
            headers=admin_headers,
        )
        assert link.status_code == 200

        # Owner bootstrap: commander, neither driver nor vendor
        owner_boot = await client.get("/api/v1/auth/mobile-bootstrap", headers=owner_headers)
        assert owner_boot.status_code == 200
        assert owner_boot.json()["me"]["is_commander"] is True
        assert owner_boot.json()["driver"] is None
        assert owner_boot.json()["vendor"] is None

        driver_email = f"driver-{uuid.uuid4().hex[:6]}@mob.test"
        vendor_email = f"vendor-{uuid.uuid4().hex[:6]}@mob.test"
        combo_email = f"combo-{uuid.uuid4().hex[:6]}@mob.test"
        phone_only = f"+9198{uuid.uuid4().int % 100000000:08d}"

        # Create vendors (vendor-only + combo DCO vendor)
        v_res = await client.post(
            "/api/v1/vendors",
            json={"name": "Pure Vendor Co", "vendor_type": "FLEET_SUPPLIER", "email": vendor_email, "phone": "+919800000001"},
            headers=owner_headers,
        )
        assert v_res.status_code == 201

        combo_v_res = await client.post(
            "/api/v1/vendors",
            json={"name": "Owner Operator Co", "vendor_type": "DCO", "email": combo_email, "phone": "+919800000002"},
            headers=owner_headers,
        )
        assert combo_v_res.status_code == 201
        combo_vendor_id = combo_v_res.json()["id"]

        # Create drivers (driver-only + combo driver + phone-only driver)
        d_res = await client.post(
            "/api/v1/drivers",
            json={
                "full_name": "Solo Driver",
                "phone": "+919800000003",
                "email": driver_email,
                "license_number": f"DL-{uuid.uuid4().hex[:8].upper()}",
            },
            headers=owner_headers,
        )
        assert d_res.status_code == 201

        cd_res = await client.post(
            "/api/v1/drivers",
            json={
                "full_name": "Combo Operator",
                "phone": "+919800000002",
                "email": combo_email,
                "vendor_id": combo_vendor_id,
                "license_number": f"DL-{uuid.uuid4().hex[:8].upper()}",
            },
            headers=owner_headers,
        )
        assert cd_res.status_code == 201

        pd_res = await client.post(
            "/api/v1/drivers",
            json={
                "full_name": "Phone Driver",
                "phone": phone_only,
                "license_number": f"DL-{uuid.uuid4().hex[:8].upper()}",
            },
            headers=owner_headers,
        )
        assert pd_res.status_code == 201

        # 1. Driver-only caller
        drv_headers = auth(token(driver_uid, driver_email.upper(), org_id=zx_org))
        drv_boot = await client.get("/api/v1/auth/mobile-bootstrap", headers=drv_headers)
        assert drv_boot.status_code == 200
        assert drv_boot.json()["driver"]["email"] == driver_email
        assert drv_boot.json()["vendor"] is None
        assert (await client.get("/api/v1/vendors/me", headers=drv_headers)).status_code == 404

        # 2. Vendor-only caller
        vnd_headers = auth(token(vendor_uid, vendor_email, org_id=zx_org))
        vnd_boot = await client.get("/api/v1/auth/mobile-bootstrap", headers=vnd_headers)
        assert vnd_boot.status_code == 200
        assert vnd_boot.json()["driver"] is None
        assert vnd_boot.json()["vendor"]["email"] == vendor_email
        assert (await client.get("/api/v1/vendors/me", headers=vnd_headers)).json()["email"] == vendor_email
        assert (await client.get("/api/v1/drivers/me", headers=vnd_headers)).status_code == 404

        # 3. Driver-cum-Vendor caller
        cmb_headers = auth(token(combo_uid, combo_email, org_id=zx_org))
        cmb_boot = await client.get("/api/v1/auth/mobile-bootstrap", headers=cmb_headers)
        assert cmb_boot.status_code == 200
        assert cmb_boot.json()["driver"]["email"] == combo_email
        assert cmb_boot.json()["vendor"]["id"] == combo_vendor_id
        assert (await client.get("/api/v1/drivers/me", headers=cmb_headers)).status_code == 200
        assert (await client.get("/api/v1/vendors/me", headers=cmb_headers)).status_code == 200

        # 4. Phone-only driver caller
        ph_headers = auth(token(phone_driver_uid, None, phone_number=phone_only, org_id=zx_org))
        ph_boot = await client.get("/api/v1/auth/mobile-bootstrap", headers=ph_headers)
        assert ph_boot.status_code == 200
        assert ph_boot.json()["driver"]["phone"] == phone_only
        assert ph_boot.json()["vendor"] is None
        assert (await client.get("/api/v1/drivers/me", headers=ph_headers)).json()["phone"] == phone_only
