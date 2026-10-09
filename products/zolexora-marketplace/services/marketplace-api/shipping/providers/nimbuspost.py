import os
import httpx
import logging
from typing import List
from shipping.base import ShippingProvider
from shipping.schemas import CourierOption, BookingResult, TrackingResult

logger = logging.getLogger("zolexora.shipping.nimbuspost")
BASE_URL = os.environ.get("NIMBUSPOST_BASE_URL", "https://api.nimbuspost.com")
API_KEY  = os.environ.get("NIMBUSPOST_API_KEY", "")
TIMEOUT  = 15.0


class NimbusPostProvider(ShippingProvider):
    name = "nimbuspost"
    display_name = "NimbusPost"

    def is_configured(self) -> bool:
        return bool(API_KEY)

    def _headers(self) -> dict:
        return {"NP-API-KEY": API_KEY, "Content-Type": "application/json"}

    async def check_serviceability(self, pickup_pincode, delivery_pincode, weight_kg, cod=False) -> List[CourierOption]:
        if not self.is_configured():
            return [self._unavailable("not_configured")]
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                resp = await c.post(f"{BASE_URL}/v1.0/courier/serviceability", headers=self._headers(), json={
                    "origin": pickup_pincode, "destination": delivery_pincode,
                    "payment_type": 2 if cod else 1,
                    "order_type": 1,
                    "weight": weight_kg,
                })
                data = resp.json()
                if not data.get("status"):
                    return [self._unavailable("not_serviceable")]
                options = []
                for courier in data.get("data", []):
                    options.append(CourierOption(
                        provider=self.name,
                        courier_name=courier.get("courier_name", "NimbusPost"),
                        service_code=str(courier.get("courier_id", "np_default")),
                        serviceable=True,
                        estimated_cost=float(courier.get("total_charges", 0)),
                        estimated_delivery_days=int(courier.get("estimated_delivery_days", 5)),
                        cod_supported=bool(courier.get("cod", False)),
                        booking_supported=True,
                        raw_payload=courier,
                    ))
                return options or [self._unavailable("no_couriers")]
        except Exception as e:
            logger.warning(f"NimbusPost serviceability error: {e}")
            return [self._unavailable(str(e))]

    async def book_shipment(self, shipment_id, order_id, service_code, pickup_pincode,
                            delivery_name, delivery_phone, delivery_email,
                            delivery_address, delivery_city, delivery_state,
                            delivery_pincode, weight_kg, length_cm, breadth_cm,
                            height_cm, declared_value, cod_amount=0.0, items=None) -> BookingResult:
        if not self.is_configured():
            return BookingResult(success=False, error_message="NimbusPost not configured")
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                resp = await c.post(f"{BASE_URL}/v1.0/shipment/create", headers=self._headers(), json={
                    "order_number": order_id,
                    "payment_type": 2 if cod_amount > 0 else 1,
                    "package_weight": weight_kg,
                    "package_length": length_cm,
                    "package_breadth": breadth_cm,
                    "package_height": height_cm,
                    "order_amount": declared_value,
                    "courier_id": service_code,
                    "consignee": {
                        "name": delivery_name,
                        "address": delivery_address,
                        "city": delivery_city,
                        "state": delivery_state,
                        "pincode": delivery_pincode,
                        "phone": delivery_phone,
                    },
                    "pickup": {"warehouse_name": "Default Warehouse", "pincode": pickup_pincode},
                    "order_items": [{"name": i.get("name","Item"), "qty": i.get("quantity",1), "price": i.get("price",0)} for i in (items or [{"name":"Order","quantity":1,"price":declared_value}])],
                })
                data = resp.json()
                awb = data.get("data", {}).get("awb_number") or data.get("data", {}).get("awb")
                if data.get("status") and awb:
                    return BookingResult(success=True, awb=awb,
                        tracking_url=f"https://www.nimbuspost.com/track/{awb}", raw_response=data)
                return BookingResult(success=False, error_message=data.get("message","booking failed"), raw_response=data)
        except Exception as e:
            return BookingResult(success=False, error_message=str(e))

    async def track_shipment(self, awb: str) -> TrackingResult:
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                resp = await c.get(f"{BASE_URL}/v1.0/shipment/track", headers=self._headers(), params={"awb": awb})
                data = resp.json()
                scans = data.get("data", {}).get("scans", [])
                events = [{"status": e.get("status"), "time": e.get("updated_at"), "location": e.get("location", "")} for e in scans]
                status = scans[0].get("status", "unknown") if scans else "unknown"
                return TrackingResult(awb=awb, current_status=status, events=events, raw_response=data)
        except Exception as e:
            return TrackingResult(awb=awb, current_status="error", events=[], raw_response={"error": str(e)})

    def _unavailable(self, reason: str) -> CourierOption:
        return CourierOption(provider=self.name, courier_name=self.display_name,
            service_code="np_default", serviceable=False, rejected_reason=reason, raw_payload={})
