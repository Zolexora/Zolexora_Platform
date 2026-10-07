import os
import httpx
import logging
from typing import List, Optional
from shipping.base import ShippingProvider
from shipping.schemas import CourierOption, BookingResult, TrackingResult

logger = logging.getLogger("zolexora.shipping.shiprocket")
BASE_URL  = os.environ.get("SHIPROCKET_BASE_URL", "https://apiv2.shiprocket.in/v1/external")
SR_EMAIL  = os.environ.get("SHIPROCKET_EMAIL", "")
SR_PASS   = os.environ.get("SHIPROCKET_PASSWORD", "")
TIMEOUT   = 20.0

_token_cache: dict = {"token": None}


async def _get_token() -> Optional[str]:
    if _token_cache["token"]:
        return _token_cache["token"]
    if not SR_EMAIL or not SR_PASS:
        return None
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as c:
            r = await c.post(f"{BASE_URL}/auth/login", json={"email": SR_EMAIL, "password": SR_PASS})
            data = r.json()
            token = data.get("token")
            _token_cache["token"] = token
            return token
    except Exception as e:
        logger.warning(f"Shiprocket auth error: {e}")
        return None


class ShiprocketProvider(ShippingProvider):
    name = "shiprocket"
    display_name = "Shiprocket"

    def is_configured(self) -> bool:
        return bool(SR_EMAIL and SR_PASS)

    async def _headers(self) -> dict:
        token = await _get_token()
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async def check_serviceability(self, pickup_pincode, delivery_pincode, weight_kg, cod=False) -> List[CourierOption]:
        if not self.is_configured():
            return [self._unavailable("not_configured")]
        try:
            headers = await self._headers()
            if not headers.get("Authorization", "").endswith("None"):
                pass
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                resp = await c.get(f"{BASE_URL}/courier/serviceability/", headers=headers, params={
                    "pickup_postcode": pickup_pincode,
                    "delivery_postcode": delivery_pincode,
                    "weight": weight_kg,
                    "cod": 1 if cod else 0,
                })
                data = resp.json()
                couriers = data.get("data", {}).get("available_courier_companies", [])
                options = []
                for cr in couriers:
                    options.append(CourierOption(
                        provider=self.name,
                        courier_name=cr.get("courier_name", "Shiprocket"),
                        service_code=str(cr.get("courier_company_id", "sr_default")),
                        serviceable=True,
                        estimated_cost=float(cr.get("rate", 0)),
                        estimated_delivery_days=int(cr.get("estimated_delivery_days", 5)),
                        cod_supported=bool(cr.get("cod", False)),
                        booking_supported=True,
                        raw_payload=cr,
                    ))
                return options or [self._unavailable("no_couriers")]
        except Exception as e:
            logger.warning(f"Shiprocket serviceability error: {e}")
            return [self._unavailable(str(e))]

    async def book_shipment(self, shipment_id, order_id, service_code, pickup_pincode,
                            delivery_name, delivery_phone, delivery_email,
                            delivery_address, delivery_city, delivery_state,
                            delivery_pincode, weight_kg, length_cm, breadth_cm,
                            height_cm, declared_value, cod_amount=0.0, items=None) -> BookingResult:
        if not self.is_configured():
            return BookingResult(success=False, error_message="Shiprocket not configured")
        try:
            headers = await self._headers()
            order_items = [{"name": i.get("name","Item"), "selling_price": str(i.get("price",0)), "units": i.get("quantity",1)} for i in (items or [{"name":"Order","price":declared_value,"quantity":1}])]
            # Step 1: create order
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                order_resp = await c.post(f"{BASE_URL}/orders/create/adhoc", headers=headers, json={
                    "order_id": order_id,
                    "order_date": __import__("datetime").datetime.now().strftime("%Y-%m-%d %H:%M"),
                    "pickup_location": "Primary",
                    "channel_id": "",
                    "billing_customer_name": delivery_name,
                    "billing_address": delivery_address,
                    "billing_city": delivery_city,
                    "billing_pincode": delivery_pincode,
                    "billing_state": delivery_state,
                    "billing_country": "India",
                    "billing_email": delivery_email,
                    "billing_phone": delivery_phone,
                    "shipping_is_billing": True,
                    "payment_method": "COD" if cod_amount > 0 else "Prepaid",
                    "sub_total": declared_value,
                    "length": length_cm,
                    "breadth": breadth_cm,
                    "height": height_cm,
                    "weight": weight_kg,
                    "order_items": order_items,
                })
                order_data = order_resp.json()
                sr_order_id = order_data.get("order_id")
                if not sr_order_id:
                    return BookingResult(success=False, error_message=str(order_data), raw_response=order_data)

                # Step 2: generate AWB
                awb_resp = await c.post(f"{BASE_URL}/courier/assign/awb", headers=headers,
                    json={"shipment_id": [order_data.get("shipment_id")], "courier_id": service_code})
                awb_data = awb_resp.json()
                awb = awb_data.get("response", {}).get("data", {}).get("awb_code")

                if awb:
                    return BookingResult(success=True, awb=awb,
                        tracking_url=f"https://app.shiprocket.in/tracking/{awb}",
                        raw_response={"order": order_data, "awb": awb_data})
                return BookingResult(success=False, error_message="AWB generation failed", raw_response=awb_data)
        except Exception as e:
            return BookingResult(success=False, error_message=str(e))

    async def track_shipment(self, awb: str) -> TrackingResult:
        try:
            headers = await self._headers()
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                resp = await c.get(f"{BASE_URL}/courier/track/awb/{awb}", headers=headers)
                data = resp.json()
                tracking = data.get("tracking_data", {})
                activities = tracking.get("shipment_track_activities", [])
                events = [{"status": a.get("activity"), "time": a.get("date"), "location": a.get("location","")} for a in activities]
                status = tracking.get("shipment_status", "unknown")
                return TrackingResult(awb=awb, current_status=str(status), events=events, raw_response=data)
        except Exception as e:
            return TrackingResult(awb=awb, current_status="error", events=[], raw_response={"error": str(e)})

    async def request_pickup(self, awb: str, pickup_date=None) -> dict:
        try:
            headers = await self._headers()
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                resp = await c.post(f"{BASE_URL}/courier/generate/pickup", headers=headers,
                    json={"shipment_id": [awb]})
                return {"supported": True, "response": resp.json()}
        except Exception as e:
            return {"supported": True, "error": str(e)}

    def _unavailable(self, reason: str) -> CourierOption:
        return CourierOption(provider=self.name, courier_name=self.display_name,
            service_code="sr_default", serviceable=False, rejected_reason=reason, raw_payload={})
