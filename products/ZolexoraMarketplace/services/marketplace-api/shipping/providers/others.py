import os
import httpx
import logging
from typing import List
from shipping.base import ShippingProvider
from shipping.schemas import CourierOption, BookingResult, TrackingResult

logger = logging.getLogger("zolexora.shipping")
TIMEOUT = 15.0


# ── Pickrr ────────────────────────────────────────────────────────────────────
class PickrrProvider(ShippingProvider):
    name = "pickrr"
    display_name = "Pickrr"

    def is_configured(self) -> bool:
        return bool(os.environ.get("PICKRR_API_KEY"))

    def _key(self): return os.environ.get("PICKRR_API_KEY", "")
    def _base(self): return os.environ.get("PICKRR_BASE_URL", "https://pickrr.com")

    async def check_serviceability(self, pickup_pincode, delivery_pincode, weight_kg, cod=False) -> List[CourierOption]:
        if not self.is_configured():
            return [self._unavailable("not_configured")]
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                r = await c.get(f"{self._base()}/serviceability/", params={
                    "auth_token": self._key(),
                    "pickup_pincode": pickup_pincode,
                    "drop_pincode": delivery_pincode,
                    "weight": weight_kg,
                })
                data = r.json()
                carriers = data.get("available_carriers") or data.get("data", [])
                if not carriers:
                    return [self._unavailable("not_serviceable")]
                return [CourierOption(
                    provider=self.name, courier_name=f"Pickrr {cr.get('carrier','Default')}",
                    service_code=str(cr.get("carrier_id", "pickrr_default")),
                    serviceable=True, estimated_cost=float(cr.get("price", cr.get("total_charges", 0))),
                    estimated_delivery_days=int(cr.get("edd_days", cr.get("estimated_days", 5))),
                    cod_supported=cod, booking_supported=True, raw_payload=cr,
                ) for cr in carriers]
        except Exception as e:
            logger.warning(f"Pickrr error: {e}")
            return [self._unavailable(str(e))]

    async def book_shipment(self, shipment_id, order_id, service_code, pickup_pincode,
                            delivery_name, delivery_phone, delivery_email,
                            delivery_address, delivery_city, delivery_state,
                            delivery_pincode, weight_kg, length_cm, breadth_cm,
                            height_cm, declared_value, cod_amount=0.0, items=None) -> BookingResult:
        if not self.is_configured():
            return BookingResult(success=False, error_message="Pickrr not configured")
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                r = await c.post(f"{self._base()}/api/v3/create_shipment/", json={
                    "auth_token": self._key(),
                    "carrier_id": service_code,
                    "client_order_id": order_id,
                    "from_pincode": pickup_pincode,
                    "to_name": delivery_name,
                    "to_phone_number": delivery_phone,
                    "to_address": delivery_address,
                    "to_pincode": delivery_pincode,
                    "to_city": delivery_city,
                    "to_state": delivery_state,
                    "weight": weight_kg,
                    "charge_weight": weight_kg,
                    "breadth": breadth_cm,
                    "length": length_cm,
                    "height": height_cm,
                    "item_name": "Order Items",
                    "item_price": declared_value,
                    "payment_mode": "COD" if cod_amount > 0 else "prepaid",
                    "cod_amount": cod_amount,
                    "invoice_value": declared_value,
                })
                data = r.json()
                awb = data.get("tracking_id") or data.get("awb")
                if awb:
                    return BookingResult(success=True, awb=awb, raw_response=data)
                return BookingResult(success=False, error_message=data.get("err","Failed"), raw_response=data)
        except Exception as e:
            return BookingResult(success=False, error_message=str(e))

    async def track_shipment(self, awb: str) -> TrackingResult:
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                r = await c.get(f"{self._base()}/api/v3/tracking/", params={"auth_token": self._key(), "tracking_id": awb})
                data = r.json()
                scans = data.get("scans", [])
                events = [{"status": s.get("status"), "time": s.get("time"), "location": s.get("location","")} for s in scans]
                return TrackingResult(awb=awb, current_status=scans[0].get("status","unknown") if scans else "unknown", events=events, raw_response=data)
        except Exception as e:
            return TrackingResult(awb=awb, current_status="error", events=[], raw_response={"error": str(e)})

    def _unavailable(self, reason): return CourierOption(provider=self.name, courier_name=self.display_name, service_code="pickrr_default", serviceable=False, rejected_reason=reason, raw_payload={})


# ── DTDC ──────────────────────────────────────────────────────────────────────
class DTDCProvider(ShippingProvider):
    name = "dtdc"
    display_name = "DTDC"

    def is_configured(self) -> bool:
        return bool(os.environ.get("DTDC_API_KEY"))

    def _headers(self): return {"Content-Type": "application/json", "client-id": os.environ.get("DTDC_API_KEY",""), "Authorization": os.environ.get("DTDC_API_SECRET","")}
    def _base(self): return os.environ.get("DTDC_BASE_URL", "https://dtdc.com")

    async def check_serviceability(self, pickup_pincode, delivery_pincode, weight_kg, cod=False) -> List[CourierOption]:
        if not self.is_configured():
            return [self._unavailable("not_configured")]
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                r = await c.post(f"{self._base()}/c2cwebservices/api/getRates", headers=self._headers(), json={
                    "pinCodeFrom": pickup_pincode, "pinCodeTo": delivery_pincode,
                    "weight": weight_kg * 1000, "codAmount": 0,
                })
                data = r.json()
                services = data.get("rates", [])
                return [CourierOption(
                    provider=self.name, courier_name=f"DTDC {s.get('productType','Standard')}",
                    service_code=s.get("productCode","DTDC_STD"),
                    serviceable=True, estimated_cost=float(s.get("totalCost",0)),
                    estimated_delivery_days=int(s.get("etd",5)),
                    cod_supported=cod, booking_supported=True, raw_payload=s,
                ) for s in services] or [self._unavailable("no_rates")]
        except Exception as e:
            return [self._unavailable(str(e))]

    async def book_shipment(self, shipment_id, order_id, service_code, pickup_pincode,
                            delivery_name, delivery_phone, delivery_email,
                            delivery_address, delivery_city, delivery_state,
                            delivery_pincode, weight_kg, length_cm, breadth_cm,
                            height_cm, declared_value, cod_amount=0.0, items=None) -> BookingResult:
        if not self.is_configured():
            return BookingResult(success=False, error_message="DTDC not configured")
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                r = await c.post(f"{self._base()}/c2cwebservices/api/booking", headers=self._headers(), json={
                    "consigneeDetails": {"name": delivery_name, "mobile": delivery_phone, "address": delivery_address, "pinCode": delivery_pincode, "city": delivery_city, "state": delivery_state},
                    "consignorPinCode": pickup_pincode,
                    "productCode": service_code,
                    "pieces": [{"weight": weight_kg*1000, "length": length_cm, "breadth": breadth_cm, "height": height_cm, "declaredValue": declared_value}],
                    "referenceNumber": order_id,
                    "codAmount": cod_amount,
                })
                data = r.json()
                awb = data.get("trackingNumber") or data.get("consignmentNumber")
                if awb:
                    return BookingResult(success=True, awb=awb, tracking_url=f"https://tracking.dtdc.com/dtdc-tracking/{awb}", raw_response=data)
                return BookingResult(success=False, error_message=str(data), raw_response=data)
        except Exception as e:
            return BookingResult(success=False, error_message=str(e))

    async def track_shipment(self, awb: str) -> TrackingResult:
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                r = await c.get(f"{self._base()}/c2cwebservices/api/tracking/{awb}", headers=self._headers())
                data = r.json()
                scans = data.get("trackDetails", [])
                events = [{"status": s.get("status",""), "time": s.get("dateTime",""), "location": s.get("location","")} for s in scans]
                return TrackingResult(awb=awb, current_status=scans[0].get("status","unknown") if scans else "unknown", events=events, raw_response=data)
        except Exception as e:
            return TrackingResult(awb=awb, current_status="error", events=[], raw_response={"error":str(e)})

    def _unavailable(self, reason): return CourierOption(provider=self.name, courier_name=self.display_name, service_code="dtdc_std", serviceable=False, rejected_reason=reason, raw_payload={})


# ── Blue Dart ─────────────────────────────────────────────────────────────────
class BlueDartProvider(ShippingProvider):
    name = "bluedart"
    display_name = "Blue Dart"

    def is_configured(self) -> bool:
        return bool(os.environ.get("BLUEDART_API_KEY"))

    def _base(self): return os.environ.get("BLUEDART_BASE_URL", "https://api.bluedart.com")
    def _headers(self): return {"JWTToken": f"LoginToken {os.environ.get('BLUEDART_API_KEY','')}", "Content-Type": "application/json"}

    async def check_serviceability(self, pickup_pincode, delivery_pincode, weight_kg, cod=False) -> List[CourierOption]:
        if not self.is_configured():
            return [self._unavailable("not_configured")]
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                r = await c.post(f"{self._base()}/shiping/api/rate-calculator/v1/GetRates", headers=self._headers(), json={
                    "Request": {
                        "Shipper": {"OriginArea": pickup_pincode, "CustomerCode": os.environ.get("BLUEDART_API_SECRET","")},
                        "Consignee": {"DestinationArea": delivery_pincode},
                        "ShipmentDetail": {"ActualWeight": weight_kg, "Dimensions": [{"Length": 10, "Breadth": 10, "Height": 10}]},
                        "Services": {"ProductCode": "A", "PayableAt": "B", "PieceCount": 1},
                    }
                })
                data = r.json()
                rates = data.get("GetRatesResult", {}).get("Rates", [])
                return [CourierOption(
                    provider=self.name, courier_name=f"Blue Dart {rt.get('ProductCode','Apex')}",
                    service_code=rt.get("ProductCode","BD_APEX"),
                    serviceable=True, estimated_cost=float(rt.get("GrossAmount",0)),
                    estimated_delivery_days=int(rt.get("ExpectedDeliveryDays",4)),
                    cod_supported=False, booking_supported=True, raw_payload=rt,
                ) for rt in rates] or [self._unavailable("no_rates")]
        except Exception as e:
            return [self._unavailable(str(e))]

    async def book_shipment(self, shipment_id, order_id, service_code, pickup_pincode,
                            delivery_name, delivery_phone, delivery_email,
                            delivery_address, delivery_city, delivery_state,
                            delivery_pincode, weight_kg, length_cm, breadth_cm,
                            height_cm, declared_value, cod_amount=0.0, items=None) -> BookingResult:
        if not self.is_configured():
            return BookingResult(success=False, error_message="Blue Dart not configured")
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                r = await c.post(f"{self._base()}/shiping/api/waybill/v1/GenerateWayBill", headers=self._headers(), json={
                    "Request": {
                        "Consignee": {"ConsigneeName": delivery_name, "ConsigneeAddress1": delivery_address, "ConsigneePincode": delivery_pincode, "ConsigneeCity": delivery_city, "ConsigneeState": delivery_state, "ConsigneeCountry": "India", "ConsigneeMobile": delivery_phone},
                        "Shipper": {"OriginArea": pickup_pincode, "CustomerCode": os.environ.get("BLUEDART_API_SECRET",""), "CustomerName": "Zolexora Seller"},
                        "ShipmentDetail": {"AWBNo": "", "ActualWeight": weight_kg, "CollectableAmount": cod_amount, "CreditReferenceNo": order_id, "DeclaredValue": declared_value, "Dimensions": [{"Count": 1, "Height": height_cm, "Length": length_cm, "Breadth": breadth_cm}], "InvoiceNo": order_id, "PieceCount": 1, "ProductCode": service_code, "ProductType": 0, "SubProductCode": "", "PackType": "Box"},
                        "Services": {"PickupTime": ""},
                    }
                })
                data = r.json()
                awb = data.get("GenerateWayBillResult", {}).get("AWBNo")
                if awb:
                    return BookingResult(success=True, awb=awb, tracking_url=f"https://www.bluedart.com/tracking/{awb}", raw_response=data)
                return BookingResult(success=False, error_message=str(data), raw_response=data)
        except Exception as e:
            return BookingResult(success=False, error_message=str(e))

    async def track_shipment(self, awb: str) -> TrackingResult:
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                r = await c.post(f"{self._base()}/shiping/api/track/v1/TrackShipment", headers=self._headers(),
                    json={"Request": {"AWBNo": awb}})
                data = r.json()
                scans = data.get("TrackShipmentResult", {}).get("Shipment", [{}])[0].get("Scans", [])
                events = [{"status": s.get("ScanDetail",{}).get("ScanType",""), "time": s.get("ScanDetail",{}).get("ScanDate",""), "location": s.get("ScanDetail",{}).get("ScannedLocation","")} for s in scans]
                return TrackingResult(awb=awb, current_status=events[0].get("status","unknown") if events else "unknown", events=events, raw_response=data)
        except Exception as e:
            return TrackingResult(awb=awb, current_status="error", events=[], raw_response={"error":str(e)})

    def _unavailable(self, reason): return CourierOption(provider=self.name, courier_name=self.display_name, service_code="BD_APEX", serviceable=False, rejected_reason=reason, raw_payload={})


# ── India Post ────────────────────────────────────────────────────────────────
class IndiaPostProvider(ShippingProvider):
    name = "indiapost"
    display_name = "India Post"

    def is_configured(self) -> bool:
        return bool(os.environ.get("INDIAPOST_API_KEY"))

    def _base(self): return os.environ.get("INDIAPOST_BASE_URL", "https://api.indiapost.gov.in")

    async def check_serviceability(self, pickup_pincode, delivery_pincode, weight_kg, cod=False) -> List[CourierOption]:
        if not self.is_configured():
            return [self._unavailable("not_configured")]
        # India Post EMS / Speed Post serviceability check
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                r = await c.get(f"{self._base()}/api/serviceability", params={
                    "api_key": os.environ.get("INDIAPOST_API_KEY",""),
                    "from_pincode": pickup_pincode,
                    "to_pincode": delivery_pincode,
                    "weight": weight_kg,
                    "service": "SpeedPost",
                })
                data = r.json()
                if not data.get("serviceable", False):
                    return [self._unavailable("not_serviceable")]
                return [CourierOption(
                    provider=self.name, courier_name="India Post Speed Post",
                    service_code="INDIAPOST_SPEEDPOST",
                    serviceable=True, estimated_cost=float(data.get("charges", 0)),
                    estimated_delivery_days=int(data.get("delivery_days", 6)),
                    cod_supported=data.get("cod_available", False),
                    booking_supported=True, raw_payload=data,
                )]
        except Exception as e:
            return [self._unavailable(str(e))]

    async def book_shipment(self, shipment_id, order_id, service_code, pickup_pincode,
                            delivery_name, delivery_phone, delivery_email,
                            delivery_address, delivery_city, delivery_state,
                            delivery_pincode, weight_kg, length_cm, breadth_cm,
                            height_cm, declared_value, cod_amount=0.0, items=None) -> BookingResult:
        if not self.is_configured():
            return BookingResult(success=False, error_message="India Post not configured")
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                r = await c.post(f"{self._base()}/api/booking", json={
                    "api_key": os.environ.get("INDIAPOST_API_KEY",""),
                    "service": service_code,
                    "sender_pincode": pickup_pincode,
                    "recipient_name": delivery_name,
                    "recipient_address": delivery_address,
                    "recipient_pincode": delivery_pincode,
                    "recipient_city": delivery_city,
                    "recipient_state": delivery_state,
                    "recipient_phone": delivery_phone,
                    "weight_grams": weight_kg * 1000,
                    "declared_value": declared_value,
                    "reference_number": order_id,
                })
                data = r.json()
                awb = data.get("consignment_number") or data.get("tracking_number")
                if awb:
                    return BookingResult(success=True, awb=awb, tracking_url=f"https://www.indiapost.gov.in/_layouts/15/DOP.Portal.Tracking/TrackConsignment.aspx?consignment={awb}", raw_response=data)
                return BookingResult(success=False, error_message=str(data), raw_response=data)
        except Exception as e:
            return BookingResult(success=False, error_message=str(e))

    async def track_shipment(self, awb: str) -> TrackingResult:
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                r = await c.get(f"{self._base()}/api/tracking/{awb}", params={"api_key": os.environ.get("INDIAPOST_API_KEY","")})
                data = r.json()
                events = data.get("events", [])
                return TrackingResult(awb=awb, current_status=data.get("current_status","unknown"), events=events, raw_response=data)
        except Exception as e:
            return TrackingResult(awb=awb, current_status="error", events=[], raw_response={"error":str(e)})

    def _unavailable(self, reason): return CourierOption(provider=self.name, courier_name=self.display_name, service_code="INDIAPOST_SPEEDPOST", serviceable=False, rejected_reason=reason, raw_payload={})
