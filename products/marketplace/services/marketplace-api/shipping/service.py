import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from motor.motor_asyncio import AsyncIOMotorDatabase

from shipping.base import ShippingProvider
from shipping.schemas import (
    ShipmentDoc, ShipmentStatus, ShipmentOptionDoc, BookingAttemptDoc,
    TrackingEventDoc, CourierOption, BookingResult,
)
from shipping.rules import filter_and_rank
from shipping.providers.delhivery import DelhiveryProvider
from shipping.providers.nimbuspost import NimbusPostProvider
from shipping.providers.shiprocket import ShiprocketProvider
from shipping.providers.others import PickrrProvider, DTDCProvider, BlueDartProvider, IndiaPostProvider

logger = logging.getLogger("zolexora.shipping.service")

# ── Provider registry ─────────────────────────────────────────────────────────
ALL_PROVIDERS: List[ShippingProvider] = [
    DelhiveryProvider(),
    NimbusPostProvider(),
    ShiprocketProvider(),
    DTDCProvider(),
    BlueDartProvider(),
    IndiaPostProvider(),
    PickrrProvider(),
]


def get_provider(name: str) -> Optional[ShippingProvider]:
    return next((p for p in ALL_PROVIDERS if p.name == name), None)


def now_iso(): return datetime.now(timezone.utc).isoformat()


# ── Core service ──────────────────────────────────────────────────────────────
class ShippingService:

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    # ── Pickup location helpers ───────────────────────────────────────────────

    async def get_default_pickup(self, seller_id: str) -> Optional[dict]:
        loc = await self.db.seller_pickup_locations.find_one(
            {"seller_id": seller_id, "is_default": True}, {"_id": 0}
        )
        if not loc:
            loc = await self.db.seller_pickup_locations.find_one(
                {"seller_id": seller_id}, {"_id": 0}
            )
        return loc

    # ── Create or get shipment for an order ──────────────────────────────────

    async def get_or_create_shipment(self, order_id: str) -> Optional[dict]:
        existing = await self.db.shipments.find_one({"order_id": order_id}, {"_id": 0})
        if existing:
            return existing

        order = await self.db.orders.find_one({"id": order_id}, {"_id": 0})
        if not order:
            return None

        shipment = ShipmentDoc(
            order_id=order_id,
            seller_id=order.get("seller_id", ""),
            buyer_id=order.get("buyer_id", ""),
            declared_value=order.get("total_paid", 0.0),
            cod_amount=0.0,
        )
        await self.db.shipments.insert_one(shipment.model_dump())
        return shipment.model_dump()

    # ── Option discovery ─────────────────────────────────────────────────────

    async def discover_options(
        self,
        shipment_id: str,
        pickup_pincode: str,
        delivery_pincode: str,
        weight_kg: float,
        cod: bool = False,
    ) -> Tuple[List[CourierOption], List[CourierOption]]:
        """
        Query all configured providers in parallel, collect options,
        apply routing rules, persist results.
        """

        # Update shipment status
        await self.db.shipments.update_one(
            {"id": shipment_id},
            {"$set": {"current_status": ShipmentStatus.DISCOVERING, "updated_at": now_iso()}}
        )

        # Query all providers concurrently
        tasks = [p.check_serviceability(pickup_pincode, delivery_pincode, weight_kg, cod)
                 for p in ALL_PROVIDERS]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        all_raw: List[CourierOption] = []
        for provider, result in zip(ALL_PROVIDERS, results):
            if isinstance(result, Exception):
                logger.warning(f"{provider.name} serviceability raised: {result}")
                all_raw.append(CourierOption(
                    provider=provider.name, courier_name=provider.display_name,
                    service_code="error", serviceable=False,
                    rejected_reason=str(result), raw_payload={}
                ))
            else:
                all_raw.extend(result)

        # Apply routing rules
        valid, rejected = filter_and_rank(all_raw)

        # Persist all options
        await self.db.shipment_options.delete_many({"shipment_id": shipment_id})
        all_docs = []
        for i, opt in enumerate(valid):
            all_docs.append(ShipmentOptionDoc(
                shipment_id=shipment_id, provider=opt.provider, courier_name=opt.courier_name,
                serviceable=True, estimated_cost=opt.estimated_cost,
                estimated_delivery_days=opt.estimated_delivery_days,
                cod_supported=opt.cod_supported, booking_supported=opt.booking_supported,
                ranking_position=i + 1, raw_payload=opt.raw_payload,
            ).model_dump())
        for opt in rejected:
            all_docs.append(ShipmentOptionDoc(
                shipment_id=shipment_id, provider=opt.provider, courier_name=opt.courier_name,
                serviceable=opt.serviceable, estimated_cost=opt.estimated_cost,
                estimated_delivery_days=opt.estimated_delivery_days,
                cod_supported=opt.cod_supported, booking_supported=opt.booking_supported,
                rejected_reason=opt.rejected_reason, raw_payload=opt.raw_payload,
            ).model_dump())
        if all_docs:
            await self.db.shipment_options.insert_many(all_docs)

        status = ShipmentStatus.OPTIONS_FOUND if valid else ShipmentStatus.ATTENTION_REQUIRED
        await self.db.shipments.update_one(
            {"id": shipment_id},
            {"$set": {
                "current_status": status,
                "shipping_attention_required": not valid,
                "updated_at": now_iso(),
            }}
        )

        logger.info(f"Shipment {shipment_id}: {len(valid)} valid options, {len(rejected)} rejected")
        return valid, rejected

    # ── Auto-booking ─────────────────────────────────────────────────────────

    async def auto_book(self, shipment_id: str, order_id: str, valid_options: List[CourierOption],
                        shipment_data: dict) -> bool:
        """
        Try booking providers in ranked order until one succeeds.
        Returns True if booking succeeded.
        """
        await self.db.shipments.update_one(
            {"id": shipment_id},
            {"$set": {"current_status": ShipmentStatus.BOOKING,
                       "auto_booking_attempted_at": now_iso(), "updated_at": now_iso()}}
        )

        attempt_number = 0
        for opt in valid_options:
            provider = get_provider(opt.provider)
            if not provider:
                continue

            attempt_number += 1
            request_payload = {
                "provider": opt.provider,
                "service_code": opt.service_code,
                "pickup_pincode": shipment_data.get("pickup_pincode"),
                "delivery_pincode": shipment_data.get("delivery_pincode"),
                "weight_kg": shipment_data.get("package_weight"),
            }

            result: BookingResult = await provider.book_shipment(
                shipment_id=shipment_id,
                order_id=order_id,
                service_code=opt.service_code,
                pickup_pincode=shipment_data.get("pickup_pincode", ""),
                delivery_name=shipment_data.get("delivery_name", ""),
                delivery_phone=shipment_data.get("delivery_phone", ""),
                delivery_email=shipment_data.get("delivery_email", ""),
                delivery_address=shipment_data.get("delivery_address", ""),
                delivery_city=shipment_data.get("delivery_city", ""),
                delivery_state=shipment_data.get("delivery_state", ""),
                delivery_pincode=shipment_data.get("delivery_pincode", ""),
                weight_kg=shipment_data.get("package_weight", 0.5),
                length_cm=shipment_data.get("length", 10.0),
                breadth_cm=shipment_data.get("breadth", 10.0),
                height_cm=shipment_data.get("height", 10.0),
                declared_value=shipment_data.get("declared_value", 0.0),
                cod_amount=shipment_data.get("cod_amount", 0.0),
                items=shipment_data.get("items", []),
            )

            # Persist attempt
            attempt = BookingAttemptDoc(
                shipment_id=shipment_id, provider=opt.provider,
                attempt_number=attempt_number,
                request_payload=request_payload,
                response_payload=result.raw_response,
                success=result.success,
                error_message=result.error_message,
            )
            await self.db.shipment_booking_attempts.insert_one(attempt.model_dump())

            if result.success:
                await self.db.shipments.update_one(
                    {"id": shipment_id},
                    {"$set": {
                        "selected_provider": opt.provider,
                        "selected_courier_name": opt.courier_name,
                        "selected_service_code": opt.service_code,
                        "awb": result.awb,
                        "label_url": result.label_url,
                        "tracking_url": result.tracking_url,
                        "shipping_cost": opt.estimated_cost,
                        "estimated_delivery_days": opt.estimated_delivery_days,
                        "current_status": ShipmentStatus.BOOKED,
                        "is_auto_booked": True,
                        "shipping_attention_required": False,
                        "updated_at": now_iso(),
                    }}
                )
                # Update order status
                await self.db.orders.update_one(
                    {"id": order_id},
                    {"$set": {"status": "shipped", "updated_at": now_iso()}}
                )
                logger.info(f"Auto-booked shipment {shipment_id} via {opt.provider}, AWB={result.awb}")
                return True
            else:
                logger.warning(f"Booking failed via {opt.provider}: {result.error_message}")

        # All providers failed
        await self.db.shipments.update_one(
            {"id": shipment_id},
            {"$set": {
                "current_status": ShipmentStatus.ATTENTION_REQUIRED,
                "shipping_attention_required": True,
                "failure_reason": f"All {attempt_number} providers failed",
                "updated_at": now_iso(),
            }}
        )
        logger.error(f"All providers failed for shipment {shipment_id}")
        return False

    # ── Trigger: seller marks ready_to_ship ──────────────────────────────────

    async def trigger_ready_to_ship(self, order_id: str, seller_id: str,
                                    pickup_location_id: Optional[str] = None,
                                    package_details: Optional[dict] = None) -> dict:
        """
        Main entry point. Called when seller marks order as ready_to_ship.
        Discovers options and auto-books the best one.
        """
        order = await self.db.orders.find_one({"id": order_id}, {"_id": 0})
        if not order:
            return {"error": "Order not found"}

        if order.get("payment_status") != "paid" and order.get("payment_method") != "coins":
            return {"error": "Order must be paid before shipping"}

        # Get or create shipment
        shipment = await self.get_or_create_shipment(order_id)
        if not shipment:
            return {"error": "Could not create shipment"}

        shipment_id = shipment["id"]

        # Get pickup location
        if pickup_location_id:
            pickup = await self.db.seller_pickup_locations.find_one({"id": pickup_location_id, "seller_id": seller_id}, {"_id": 0})
        else:
            pickup = await self.get_default_pickup(seller_id)

        if not pickup:
            return {"error": "No pickup location configured. Please add a pickup address first."}

        # Merge package details
        pkg = package_details or {}
        await self.db.shipments.update_one(
            {"id": shipment_id},
            {"$set": {
                "pickup_location_id": pickup["id"],
                "pickup_pincode": pickup["pincode"],
                "delivery_pincode": order.get("delivery_pincode", ""),
                "delivery_name": order.get("buyer_name", ""),
                "delivery_phone": order.get("delivery_phone", ""),
                "delivery_email": order.get("delivery_email", ""),
                "delivery_address": order.get("delivery_address", ""),
                "delivery_city": order.get("delivery_city", ""),
                "delivery_state": order.get("delivery_state", ""),
                "package_weight": pkg.get("weight_kg", 0.5),
                "length": pkg.get("length_cm", 10.0),
                "breadth": pkg.get("breadth_cm", 10.0),
                "height": pkg.get("height_cm", 10.0),
                "declared_value": order.get("total_paid", 0.0),
                "items": order.get("items", []),
                "updated_at": now_iso(),
            }}
        )

        updated_shipment = await self.db.shipments.find_one({"id": shipment_id}, {"_id": 0})

        # Discover options
        valid, rejected = await self.discover_options(
            shipment_id=shipment_id,
            pickup_pincode=pickup["pincode"],
            delivery_pincode=order.get("delivery_pincode", ""),
            weight_kg=pkg.get("weight_kg", 0.5),
            cod=order.get("cod_amount", 0) > 0,
        )

        if not valid:
            return {
                "status": "attention_required",
                "message": "No valid courier options found for this route",
                "shipment_id": shipment_id,
                "rejected_count": len(rejected),
            }

        # Auto-book
        success = await self.auto_book(
            shipment_id=shipment_id,
            order_id=order_id,
            valid_options=valid,
            shipment_data=updated_shipment or {},
        )

        result = await self.db.shipments.find_one({"id": shipment_id}, {"_id": 0})
        return {
            "status": "booked" if success else "attention_required",
            "shipment": result,
            "valid_options": len(valid),
            "rejected_options": len(rejected),
        }

    # ── Manual override ───────────────────────────────────────────────────────

    async def manual_book(self, shipment_id: str, order_id: str,
                          provider_name: str, service_code: str, courier_name: str) -> dict:
        provider = get_provider(provider_name)
        if not provider:
            return {"error": f"Unknown provider: {provider_name}"}

        shipment = await self.db.shipments.find_one({"id": shipment_id}, {"_id": 0})
        if not shipment:
            return {"error": "Shipment not found"}

        opt_stub = CourierOption(
            provider=provider_name, courier_name=courier_name,
            service_code=service_code, serviceable=True
        )

        success = await self.auto_book(
            shipment_id=shipment_id, order_id=order_id,
            valid_options=[opt_stub], shipment_data=shipment
        )
        updated = await self.db.shipments.find_one({"id": shipment_id}, {"_id": 0})
        return {"status": "booked" if success else "failed", "shipment": updated}

    # ── Tracking sync ─────────────────────────────────────────────────────────

    async def sync_tracking(self, shipment_id: str) -> dict:
        shipment = await self.db.shipments.find_one({"id": shipment_id}, {"_id": 0})
        if not shipment or not shipment.get("awb"):
            return {"error": "No AWB found"}

        provider = get_provider(shipment.get("selected_provider", ""))
        if not provider:
            return {"error": "Provider not found"}

        result = await provider.track_shipment(shipment["awb"])

        # Persist new events
        existing_events = await self.db.shipment_tracking_events.distinct(
            "event_time", {"shipment_id": shipment_id}
        )
        new_events = []
        for ev in result.events:
            event_time = str(ev.get("time", ""))
            if event_time not in existing_events:
                new_events.append(TrackingEventDoc(
                    shipment_id=shipment_id, provider=shipment["selected_provider"],
                    awb=shipment["awb"], status=str(ev.get("status", "")),
                    description=str(ev.get("status", "")),
                    location=str(ev.get("location", "")),
                    event_time=event_time, raw_payload=ev,
                ).model_dump())

        if new_events:
            await self.db.shipment_tracking_events.insert_many(new_events)

        # Map provider status to our status
        status_map = {
            "delivered": ShipmentStatus.DELIVERED,
            "out for delivery": ShipmentStatus.OUT_FOR_DELIVERY,
            "in transit": ShipmentStatus.IN_TRANSIT,
        }
        mapped = next((v for k, v in status_map.items() if k in result.current_status.lower()), None)
        if mapped:
            await self.db.shipments.update_one(
                {"id": shipment_id},
                {"$set": {"current_status": mapped, "updated_at": now_iso()}}
            )

        return {"awb": shipment["awb"], "current_status": result.current_status, "new_events": len(new_events)}
