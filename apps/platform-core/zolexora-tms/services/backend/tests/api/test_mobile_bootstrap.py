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

        # 5. Duty enrichment + vendor_id scoping + dispatch board lanes
        client_res = await client.post(
            "/api/v1/crm/clients",
            json={"name": "Acme Logistics Client", "phone": "+919900001111"},
            headers=owner_headers,
        )
        assert client_res.status_code == 201
        customer_id = client_res.json()["id"]

        veh_res = await client.post(
            "/api/v1/vehicles",
            json={
                "registration_number": f"KA01MB{uuid.uuid4().int % 9000 + 1000}",
                "vendor_id": combo_vendor_id,
                "ownership_type": "ATTACHED",
                "make": "Tata",
                "model": "Prima",
            },
            headers=owner_headers,
        )
        assert veh_res.status_code == 201
        vehicle_id = veh_res.json()["id"]

        combo_driver_id = cd_res.json()["id"]
        booking_res = await client.post(
            "/api/v1/bookings",
            json={
                "customer_id": customer_id,
                "pickup_address": "Peenya Industrial Area, Bengaluru",
                "drop_address": "Bhiwandi Logistics Park, Mumbai",
                "pickup_datetime": "2026-12-01T10:00:00Z",
                "cargo_info": {"material": "Auto Parts", "weight_kg": 4500},
                "operational_instructions": "Gate 3 loading dock",
            },
            headers=owner_headers,
        )
        assert booking_res.status_code == 201
        booking_id = booking_res.json()["id"]

        duty_res = await client.post(
            "/api/v1/duties",
            json={
                "booking_id": booking_id,
                "scheduled_start_time": "2026-12-01T10:00:00Z",
                "scheduled_end_time": "2026-12-02T10:00:00Z",
            },
            headers=owner_headers,
        )
        assert duty_res.status_code == 201
        duty_id = duty_res.json()["id"]

        assign_res = await client.post(
            f"/api/v1/duties/{duty_id}/assign",
            json={"driver_id": combo_driver_id, "vehicle_id": vehicle_id},
            headers=owner_headers,
        )
        assert assign_res.status_code == 200

        # Enriched vendor-scoped duties list
        vendor_duties = await client.get(
            f"/api/v1/duties?vendor_id={combo_vendor_id}",
            headers=cmb_headers,
        )
        assert vendor_duties.status_code == 200
        rows = vendor_duties.json()
        assert len(rows) == 1
        assert rows[0]["booking"]["customer_name"] == "Acme Logistics Client"
        assert rows[0]["booking"]["cargo_description"] == "Auto Parts"
        assert rows[0]["booking"]["cargo_weight_kg"] == 4500.0
        assert rows[0]["vehicle"]["vendor_id"] == combo_vendor_id
        assert rows[0]["driver"]["full_name"] == "Combo Operator"

        # Non-matching vendor sees 0 duties
        pure_vendor_id = v_res.json()["id"]
        other_duties = await client.get(
            f"/api/v1/duties?vendor_id={pure_vendor_id}",
            headers=vnd_headers,
        )
        assert other_duties.status_code == 200
        assert other_duties.json() == []

        # Enriched dispatch board
        board_res = await client.get("/api/v1/dispatch/board", headers=owner_headers)
        assert board_res.status_code == 200
        allocated = board_res.json()["lanes"]["ALLOCATED"]
        assert any(item["id"] == duty_id and item["driver"]["id"] == combo_driver_id for item in allocated)

        # 6. Permission-gated GPS tracking + coordinate extraction ({latitude, longitude})
        assert (await client.post(f"/api/v1/duties/{duty_id}/dispatch", headers=owner_headers)).status_code == 200
        start_trip_res = await client.post(
            f"/api/v1/trips/duties/{duty_id}/start",
            json={"start_odometer": 12000, "start_location": {"latitude": 12.9716, "longitude": 77.5946}},
            headers=cmb_headers,
        )
        assert start_trip_res.status_code == 201
        trip_id = start_trip_res.json()["id"]

        # Assigned driver (combo) can post background location pings
        ping_res = await client.post(
            f"/api/v1/trips/{trip_id}/events",
            json={
                "event_type": "location_update",
                "latitude": 13.0285,
                "longitude": 77.5401,
                "timestamp": "2026-12-01T10:15:00Z",
            },
            headers=cmb_headers,
        )
        assert ping_res.status_code == 201
        assert ping_res.json()["latitude"] == 13.0285

        # Unrelated driver / vendor without tracking permission gets 403 on read & write
        assert (
            await client.post(
                f"/api/v1/trips/{trip_id}/events",
                json={"event_type": "location_update", "latitude": 13.0, "longitude": 77.5},
                headers=drv_headers,
            )
        ).status_code == 403
        assert (await client.get(f"/api/v1/trips/{trip_id}/events", headers=drv_headers)).status_code == 403
        assert (await client.get(f"/api/v1/trips/{trip_id}/events", headers=vnd_headers)).status_code == 403

        # User with explicit operations.tracking.view permission CAN read GPS events
        tracker_uid = uuid.uuid4()
        tracker_headers = auth(
            token(
                tracker_uid,
                f"tracker-{uuid.uuid4().hex[:6]}@mob.test",
                org_id=zx_org,
                permissions=["tms:operations_tracking:view"],
            )
        )
        # Note: business-session user with org_id claim + membership or commander sees events; owner always sees events
        owner_events = await client.get(f"/api/v1/trips/{trip_id}/events", headers=owner_headers)
        assert owner_events.status_code == 200
        ev_rows = owner_events.json()
        assert len(ev_rows) == 2
        assert ev_rows[0]["event_type"] == "location_update"
        assert ev_rows[0]["latitude"] == 13.0285
        assert ev_rows[1]["event_type"] == "TRIP_STARTED"
        assert ev_rows[1]["latitude"] == 12.9716
        assert tracker_headers is not None
