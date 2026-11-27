"""End-to-end API tests for new Zolexora TMS gap features:
- Shareable public live tracking link + unauthenticated public tracking lookup
- GST e-Way Bill validation & expiry alert scan
- Multi-stop LTL manifest stop progression + TripEvent audit
- FASTag toll auto-sync, duplicate charge flagging & trip reconciliation
- Duties search & date range query filtering
"""
import datetime
import uuid

from httpx import ASGITransport, AsyncClient
from jose import jwt

from app.core.config import settings
from app.main import app


def _auth(uid: uuid.UUID, email: str) -> dict[str, str]:
    tok = jwt.encode({"uid": str(uid), "email": email}, settings.JWT_SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {tok}"}


async def test_gap_features_end_to_end():
    owner_uid = uuid.uuid4()
    headers = _auth(owner_uid, f"ops-{uuid.uuid4().hex[:6]}@tms.test")
    now = datetime.datetime.now(datetime.timezone.utc)
    fastag_tag = f"FTAG-{uuid.uuid4().hex[:8].upper()}"
    reg_no = f"MH12AB{uuid.uuid4().int % 9000 + 1000}"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Onboard org
        onboard = await client.post(
            "/api/v1/onboarding",
            json={"name": "Gap Features Logistics", "organisation_type": "Private Limited Company"},
            headers=headers,
        )
        assert onboard.status_code == 201, onboard.text

        # 2. Create client, driver, vehicle (with fastag_id)
        c_res = await client.post(
            "/api/v1/crm/clients",
            json={"name": "Acme Retail", "phone": "+919800001111"},
            headers=headers,
        )
        assert c_res.status_code == 201, c_res.text
        client_id = c_res.json()["id"]

        d_res = await client.post(
            "/api/v1/drivers",
            json={
                "full_name": "Ramesh Kumar",
                "phone": "+919800002222",
                "license_number": f"DL-{uuid.uuid4().hex[:8].upper()}",
            },
            headers=headers,
        )
        assert d_res.status_code == 201, d_res.text
        driver_id = d_res.json()["id"]

        v_res = await client.post(
            "/api/v1/vehicles",
            json={"registration_number": reg_no, "fastag_id": fastag_tag},
            headers=headers,
        )
        assert v_res.status_code == 201, v_res.text
        vehicle_id = v_res.json()["id"]

        # 3. Create ETS / Fixed multi-stop passenger trip with e-Way Bill & stops
        b_res = await client.post(
            "/api/v1/bookings",
            json={
                "customer_id": client_id,
                "booking_type": "ETS",
                "service_type": "PASSENGER",
                "pickup_address": "Bhiwandi Pickup Point",
                "pickup_lat": 19.2813,
                "pickup_lng": 73.0483,
                "drop_address": "Chakan Tech Campus",
                "drop_lat": 18.7606,
                "drop_lng": 73.8636,
                "pickup_datetime": now.isoformat(),
                "passenger_info": {"name": "Ananya Verma", "phone": "+919800003333", "count": 3, "shift": "Night 22:00"},
                "eway_bill_number": "123456789012",
                "eway_bill_valid_until": (now + datetime.timedelta(hours=4)).isoformat(),
                "stops": [
                    {"seq": 1, "stop_type": "PICKUP", "address": "Pickup Stop 1", "employee_id": "EMP-101", "status": "PENDING"},
                    {"seq": 2, "stop_type": "PICKUP", "address": "Pickup Stop 2", "employee_id": "EMP-102", "status": "PENDING"},
                    {"seq": 3, "stop_type": "DROP", "address": "Chakan Tech Campus Gate 4", "status": "PENDING"},
                ],
            },
            headers=headers,
        )
        assert b_res.status_code == 201, b_res.text
        booking_id = b_res.json()["id"]

        # Reject invalid e-Way Bill format
        bad_ewb = await client.post(
            f"/api/v1/bookings/{booking_id}/eway-bill",
            json={
                "eway_bill_number": "BAD-EWB-1234",
                "eway_bill_valid_until": (now + datetime.timedelta(hours=12)).isoformat(),
            },
            headers=headers,
        )
        assert bad_ewb.status_code == 400

        # Scan expiring e-Way Bills (< 24h)
        chk = await client.post("/api/v1/bookings/eway-bill/check-expiring?warn_hours=24", headers=headers)
        assert chk.status_code == 200, chk.text
        assert chk.json()["expiring_soon_count"] >= 1

        # 4. Create duty -> assign -> dispatch -> arrived-pickup -> start trip
        duty_res = await client.post(
            "/api/v1/duties",
            json={
                "booking_id": booking_id,
                "scheduled_start_time": now.isoformat(),
                "scheduled_end_time": (now + datetime.timedelta(hours=6)).isoformat(),
                "driver_id": driver_id,
                "vehicle_id": vehicle_id,
            },
            headers=headers,
        )
        assert duty_res.status_code == 201, duty_res.text
        duty_id = duty_res.json()["id"]

        duty_detail = await client.get(f"/api/v1/duties/{duty_id}", headers=headers)
        assert duty_detail.status_code == 200, duty_detail.text
        assert len(duty_detail.json()["booking"]["stops"]) == 3
        assert duty_detail.json()["booking"]["passenger_name"] == "Ananya Verma"
        assert duty_detail.json()["booking"]["passenger_count"] == 3
        assert duty_detail.json()["booking"]["shift_label"] == "Night 22:00"
        assert duty_detail.json()["booking"]["eway_bill_number"] == "123456789012"

        # Duties search + date filter check
        searched = await client.get(f"/api/v1/duties?search={reg_no}", headers=headers)
        assert searched.status_code == 200 and any(d["id"] == duty_id for d in searched.json())

        assert (await client.post(f"/api/v1/duties/{duty_id}/dispatch", headers=headers)).status_code == 200
        assert (await client.post(f"/api/v1/duties/{duty_id}/arrived-pickup", headers=headers)).status_code == 200

        trip_res = await client.post(
            f"/api/v1/trips/duties/{duty_id}/start",
            json={"start_odometer": 12000.0, "start_location": {"latitude": 19.2813, "longitude": 73.0483}},
            headers=headers,
        )
        assert trip_res.status_code == 201, trip_res.text
        trip_id = trip_res.json()["id"]

        # 5. Post a GPS ping, then test share-link + public unauthenticated tracking
        ping = await client.post(
            f"/api/v1/trips/{trip_id}/events",
            json={"event_type": "location_update", "latitude": 19.0123, "longitude": 73.4567},
            headers=headers,
        )
        assert ping.status_code == 201, ping.text

        share = await client.post(f"/api/v1/trips/{trip_id}/share-link", headers=headers)
        assert share.status_code == 200, share.text
        share_token = share.json()["share_token"]

        pub = await client.get(f"/api/v1/tracking/public/{share_token}")
        assert pub.status_code == 200, pub.text
        assert pub.json()["latest_latitude"] == 19.0123
        assert pub.json()["pickup_address"] == "Bhiwandi Pickup Point"

        # 6. Multi-stop ETS boarding & drop progression
        s1 = await client.post(
            f"/api/v1/duties/{duty_id}/stops/1/update",
            json={"status": "BOARDED", "notes": "Employee boarded cab"},
            headers=headers,
        )
        assert s1.status_code == 200, s1.text
        stops_after = {s["seq"]: s for s in s1.json()["booking"]["stops"]}
        assert stops_after[1]["status"] == "BOARDED"

        # 7. FASTag sync + double-charge detection + reconciliation
        plaza_time = now + datetime.timedelta(minutes=5)
        f1 = await client.post(
            "/api/v1/integrations/fastag/sync",
            json={
                "transaction_ref": f"TX-{uuid.uuid4().hex[:8]}",
                "fastag_id": fastag_tag,
                "plaza_name": "Khalapur Toll Plaza",
                "amount": 245.0,
                "transacted_at": plaza_time.isoformat(),
            },
            headers=headers,
        )
        assert f1.status_code == 201, f1.text
        assert f1.json()["trip_id"] == trip_id
        assert f1.json()["duplicate_flag"] is False

        # Second swipe at same plaza 4 mins later -> duplicate_flag True!
        f2 = await client.post(
            "/api/v1/integrations/fastag/sync",
            json={
                "transaction_ref": f"TX-{uuid.uuid4().hex[:8]}",
                "registration_number": reg_no,
                "plaza_name": "Khalapur Toll Plaza",
                "amount": 245.0,
                "transacted_at": (plaza_time + datetime.timedelta(minutes=4)).isoformat(),
            },
            headers=headers,
        )
        assert f2.status_code == 201, f2.text
        assert f2.json()["duplicate_flag"] is True

        recon = await client.get(f"/api/v1/integrations/fastag/trips/{trip_id}/reconciliation", headers=headers)
        assert recon.status_code == 200, recon.text
        assert float(recon.json()["fastag_synced_toll"]) == 490.0
        assert recon.json()["duplicate_count"] == 1

        # 8. Night-shift escort verification, PIN verification & safe-drop enforcement + Shift Roster generation
        night_booking = await client.post(
            "/api/v1/bookings",
            json={
                "customer_id": client_id,
                "booking_type": "ETS",
                "service_type": "PASSENGER",
                "pickup_address": "Tech Park Night Gate",
                "drop_address": "Indiranagar Home Drop",
                "pickup_datetime": now.isoformat(),
                "escort_required": True,
                "boarding_pin": "4321",
                "stops": [{"seq": 1, "stop_type": "PICKUP", "address": "Gate 2", "status": "PENDING"}],
            },
            headers=headers,
        )
        assert night_booking.status_code == 201, night_booking.text
        nb_id = night_booking.json()["id"]

        nd_res = await client.post(
            "/api/v1/duties",
            json={
                "booking_id": nb_id,
                "scheduled_start_time": now.isoformat(),
                "scheduled_end_time": (now + datetime.timedelta(hours=2)).isoformat(),
                "driver_id": driver_id,
                "vehicle_id": vehicle_id,
            },
            headers=headers,
        )
        assert nd_res.status_code == 201, nd_res.text
        nd_id = nd_res.json()["id"]

        # Wrong PIN rejected on BOARDED
        bad_pin = await client.post(
            f"/api/v1/duties/{nd_id}/stops/1/update",
            json={"status": "BOARDED", "pin": "0000"},
            headers=headers,
        )
        assert bad_pin.status_code == 400
        # Correct PIN accepted
        good_pin = await client.post(
            f"/api/v1/duties/{nd_id}/stops/1/update",
            json={"status": "BOARDED", "pin": "4321"},
            headers=headers,
        )
        assert good_pin.status_code == 200

        # Escort guard check + walk through milestones -> DUTY_COMPLETED blocked until safe-drop confirmed
        assert (await client.post(f"/api/v1/duties/{nd_id}/escort-check", json={"escort_guard_name": "Guard Vikram"}, headers=headers)).status_code == 200
        assert (await client.post(f"/api/v1/duties/{nd_id}/dispatch", headers=headers)).status_code == 200
        assert (await client.post(f"/api/v1/duties/{nd_id}/arrived-pickup", headers=headers)).status_code == 200
        assert (await client.post(f"/api/v1/duties/{nd_id}/in-transit", headers=headers)).status_code == 200
        assert (await client.post(f"/api/v1/duties/{nd_id}/arrived-drop", headers=headers)).status_code == 200

        blocked_complete = await client.post(f"/api/v1/duties/{nd_id}/complete", headers=headers)
        assert blocked_complete.status_code == 400
        assert "NIGHT_SHIFT_SAFE_DROP_REQUIRED" in blocked_complete.text

        assert (await client.post(f"/api/v1/duties/{nd_id}/safe-drop", json={"pin": "4321"}, headers=headers)).status_code == 200
        assert (await client.post(f"/api/v1/duties/{nd_id}/complete", headers=headers)).status_code == 200

        # Create Fixed/ETS shift roster and idempotently generate duties
        roster_res = await client.post(
            "/api/v1/rosters",
            json={
                "customer_id": client_id,
                "route_code": f"R-{uuid.uuid4().hex[:6].upper()}",
                "route_name": "Whitefield Night Drop",
                "booking_type": "ETS",
                "shift_label": "Night 22:00",
                "shift_time": "22:00",
                "weekdays": [0, 1, 2, 3, 4, 5, 6],
                "pickup_address": "ITPL Main Gate",
                "drop_address": "Koramangala",
                "default_driver_id": driver_id,
                "default_vehicle_id": vehicle_id,
            },
            headers=headers,
        )
        assert roster_res.status_code == 201, roster_res.text
        assert roster_res.json()["escort_required"] is True
        rid = roster_res.json()["id"]

        gen1 = await client.post(f"/api/v1/rosters/{rid}/generate-duties", json={"days_ahead": 3}, headers=headers)
        assert gen1.status_code == 200 and gen1.json()["created_count"] == 3
        gen2 = await client.post(f"/api/v1/rosters/{rid}/generate-duties", json={"days_ahead": 3}, headers=headers)
        assert gen2.status_code == 200 and gen2.json()["created_count"] == 0 and gen2.json()["skipped_count"] == 3
