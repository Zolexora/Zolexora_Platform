import os
import httpx
import logging
from typing import List
from shipping.base import ShippingProvider
from shipping.schemas import CourierOption, BookingResult, TrackingResult

logger = logging.getLogger("zolexora.shipping.delhivery")

BASE_URL = os.environ.get("DELHIVERY_BASE_URL", "https://track.delhivery.com")
API_TOKEN = os.environ.get("DELHIVERY_API_TOKEN", "")
TIMEOUT = 15.0


class DelhiveryProvider(ShippingProvider):
    name = "delhivery"
    display_name = "Delhivery"

    def is_configured(self) -> bool:
        return bool(API_TOKEN)

    def _headers(self) -> dict:
        return {
            "Authorization": f"Token {API_TOKEN}",
            "Content-Type": "application/json",
        }

    async def check_serviceability(self, pickup_pincode, delivery_pincode, weight_kg, cod=False) -> List[CourierOption]:
        if not self.is_configured():
            return [CourierOption(provider=self.name, courier_name=self.display_name, service_code="delhivery_express",
                                  serviceable=False, rejected_reason="not_configured", booking_supported=True, raw_payload={})]
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                resp = await client.get(
                    f"{BASE_URL}/api/kinko/v1/invoice/charges/.json",
                    headers=self._headers(),
                    params={
                        "md": "S",           # Surface
                        "ss": "Delivered",
                        "d_pin": delivery_pincode,
                        "o_pin": pickup_pincode,
                        "cgm": weight_kg * 1000,  # grams
                        "pt": "Pre-paid",
                        "cod": 0,
                    },
                )
                data = resp.json()
                self._log("debug", f"serviceability raw: {data}")

                if resp.status_code != 200 or not data:
                    return [self._unavailable("api_error")]

                # Delhivery returns a list of rate cards
                options = []
                for item in (data if isinstance(data, list) else [data]):
                    cost = item.get("total_amount") or item.get("charge_billing_zone")
                    days = item.get("tat_days") or item.get("g_days") or 5
                    options.append(CourierOption(
                        provider=self.name,
                        courier_name=f"Delhivery {item.get('type','Express')}",
                        service_code=f"delhivery_{item.get('type','express').lower()}",
                        serviceable=True,
                        estimated_cost=float(cost) if cost else None,
                        estimated_delivery_days=int(days),
                        cod_supported=cod,
                        booking_supported=True,
                        raw_payload=item,
                    ))
                return options if options else [self._unavailable("no_rates")]
        except Exception as e:
            logger.warning(f"Delhivery serviceability error: {e}")
            return [self._unavailable(str(e))]

    async def book_shipment(self, shipment_id, order_id, service_code, pickup_pincode,
                            delivery_name, delivery_phone, delivery_email,
                            delivery_address, delivery_city, delivery_state,
                            delivery_pincode, weight_kg, length_cm, breadth_cm,
                            height_cm, declared_value, cod_amount=0.0, items=None) -> BookingResult:
        if not self.is_configured():
            return BookingResult(success=False, error_message="Delhivery not configured")
        try:
            payload = {
                "format": "json",
                "data": [{
                    "name": delivery_name,
                    "add": delivery_address,
                    "pin": delivery_pincode,
                    "city": delivery_city,
                    "state": delivery_state,
                    "country": "India",
                    "phone": delivery_phone,
                    "order": order_id,
                    "payment_mode": "COD" if cod_amount > 0 else "Pre-paid",
                    "return_pin": pickup_pincode,
                    "return_city": "",
                    "return_phone": "",
                    "return_name": "Zolexora Seller",
                    "return_add": "",
                    "return_state": "",
                    "return_country": "India",
                    "products_desc": "Order items",
                    "hsn_code": "",
                    "cod_amount": cod_amount,
                    "order_date": None,
                    "total_amount": declared_value,
                    "seller_add": "",
                    "seller_name": "Zolexora Seller",
                    "seller_inv": order_id,
                    "quantity": sum(i.get("quantity", 1) for i in (items or [{"quantity": 1}])),
                    "waybill": "",
                    "shipment_width": breadth_cm,
                    "shipment_height": height_cm,
                    "weight": weight_kg,
                    "shipment_length": length_cm,
                    "selling_price": declared_value,
                    "caller": "",
                    "call_before_delivery": "",
                    "category": "Fashion",
                    "invoice_amount": declared_value,
                    "fragile_shipment": False,
                }]
            }
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                resp = await client.post(f"{BASE_URL}/api/cmu/create.json", headers=self._headers(), json=payload)
                data = resp.json()
                self._log("debug", f"booking raw: {data}")
                packages = data.get("packages", [{}])
                pkg = packages[0] if packages else {}
                awb = pkg.get("waybill") or pkg.get("refnum")
                if awb:
                    return BookingResult(success=True, awb=awb,
                        tracking_url=f"https://www.delhivery.com/track/package/{awb}",
                        raw_response=data)
                return BookingResult(success=False, error_message=str(data), raw_response=data)
        except Exception as e:
            return BookingResult(success=False, error_message=str(e))

    async def track_shipment(self, awb: str) -> TrackingResult:
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                resp = await client.get(f"{BASE_URL}/api/v1/packages/json/",
                    headers=self._headers(), params={"waybill": awb, "verbose": True})
                data = resp.json()
                shipments = data.get("ShipmentData", [{}])
                s = shipments[0].get("Shipment", {}) if shipments else {}
                events = [{"status": e.get("Activity"), "time": e.get("Date"), "location": e.get("Location")}
                          for e in s.get("Scans", [])]
                return TrackingResult(awb=awb, current_status=s.get("Status", "unknown"), events=events, raw_response=data)
        except Exception as e:
            return TrackingResult(awb=awb, current_status="error", events=[], raw_response={"error": str(e)})

    async def cancel_shipment(self, awb: str) -> dict:
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                resp = await client.post(f"{BASE_URL}/api/p/edit", headers=self._headers(),
                    json={"waybill": awb, "cancellation": True})
                return {"supported": True, "response": resp.json()}
        except Exception as e:
            return {"supported": True, "error": str(e)}

    def _unavailable(self, reason: str) -> CourierOption:
        return CourierOption(provider=self.name, courier_name=self.display_name,
            service_code="delhivery_express", serviceable=False,
            rejected_reason=reason, booking_supported=True, raw_payload={})
