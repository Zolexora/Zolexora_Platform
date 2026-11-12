import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from commerce import orders as order_store
from shipping import store

from shipping.base import ShippingProvider
from shipping.schemas import (
    ShipmentStatus, ShipmentOptionDoc, BookingAttemptDoc,
    TrackingEventDoc, CourierOption, BookingResult, apply_courier_status,
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

    def __init__(self, pg):
        self.pg = pg  # orders, shipments and pickup locations (PostgreSQL)

    async def get_default_pickup(self, seller_id: str) -> Optional[dict]:
        return await store.pickup(self.pg, seller_id)

    async def get_or_create_shipment(self, order_id: str) -> Optional[dict]:
        order = await order_store.get(self.pg, id=order_id)
        return await store.get_or_create(self.pg, order) if order else None

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
        await store.update(self.pg, shipment_id, {"current_status": ShipmentStatus.DISCOVERING})

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
        all_docs = []
        for i, opt in enumerate(valid):
            all_docs.append(ShipmentOptionDoc(
                shipment_id=shipment_id, provider=opt.provider, courier_name=opt.courier_name, service_code=opt.service_code,
                serviceable=True, estimated_cost=opt.estimated_cost,
                estimated_delivery_days=opt.estimated_delivery_days,
                cod_supported=opt.cod_supported, booking_supported=opt.booking_supported,
                ranking_position=i + 1, raw_payload=opt.raw_payload,
            ).model_dump())
        for opt in rejected:
            all_docs.append(ShipmentOptionDoc(
                shipment_id=shipment_id, provider=opt.provider, courier_name=opt.courier_name, service_code=opt.service_code,
                serviceable=opt.serviceable, estimated_cost=opt.estimated_cost,
                estimated_delivery_days=opt.estimated_delivery_days,
                cod_supported=opt.cod_supported, booking_supported=opt.booking_supported,
                rejected_reason=opt.rejected_reason, raw_payload=opt.raw_payload,
            ).model_dump())
        status = ShipmentStatus.OPTIONS_FOUND if valid else ShipmentStatus.ATTENTION_REQUIRED
        await store.update(self.pg, shipment_id, {"options": all_docs, "current_status": status,
                                                  "shipping_attention_required": not valid})

        logger.info(f"Shipment {shipment_id}: {len(valid)} valid options, {len(rejected)} rejected")
        return valid, rejected

    # ── Auto-booking ─────────────────────────────────────────────────────────

    async def auto_book(self, shipment_id: str, order_id: str, valid_options: List[CourierOption],
                        shipment_data: dict) -> bool:
        """
        Try booking providers in ranked order until one succeeds.
        Returns True if booking succeeded.
        """
        # Claim the shipment so a double click or a retry can't buy a second AWB. A claim older
        # than 10 minutes is treated as abandoned (the process died mid-booking).
        stale = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
        if not await store.claim_booking(self.pg, shipment_id, now_iso(), stale):
            logger.warning(f"Shipment {shipment_id} is already booked or being booked")
            return False

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
            await store.append(self.pg, shipment_id, "booking_attempts", [attempt.model_dump()])

            if result.success:
                await store.update(self.pg, shipment_id, {
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
                })
                # Update order status
                await order_store.update(self.pg, order_id, {"status": "fulfilled", "fulfillment_status": "shipped"})
                logger.info(f"Auto-booked shipment {shipment_id} via {opt.provider}, AWB={result.awb}")
                return True
            else:
                logger.warning(f"Booking failed via {opt.provider}: {result.error_message}")

        # All providers failed
        await store.update(self.pg, shipment_id, {
            "current_status": ShipmentStatus.ATTENTION_REQUIRED,
            "shipping_attention_required": True,
            "failure_reason": f"All {attempt_number} providers failed",
        })
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
        order = await order_store.get(self.pg, id=order_id, seller_id=seller_id)
        if not order:
            return {"error": "Order not found"}

        if order.get("payment_status") != "paid":
            return {"error": "Order must be paid before shipping"}

        # Get or create shipment
        shipment = await self.get_or_create_shipment(order_id)
        if not shipment:
            return {"error": "Could not create shipment"}

        shipment_id = shipment["id"]
        if shipment.get("awb"):
            return {"status": "booked", "shipment": shipment}

        # Get pickup location
        pickup = await store.pickup(self.pg, seller_id, pickup_location_id)

        if not pickup:
            return {"error": "No pickup location configured. Please add a pickup address first."}

        # Merge package details
        pkg = package_details or {}
        address = order.get("shipping_address") or {}
        await store.update(self.pg, shipment_id, {
            "pickup_location_id": pickup["id"],
            "pickup_pincode": pickup["pincode"],
            "delivery_pincode": address.get("postal_code", ""),
            "delivery_name": address.get("full_name", ""),
            "delivery_phone": address.get("phone", ""),
            "delivery_email": address.get("email", ""),
            "delivery_address": ", ".join(filter(None, (address.get("address_line1"), address.get("address_line2")))),
            "delivery_city": address.get("city", ""),
            "delivery_state": address.get("state", ""),
            "package_weight": pkg.get("weight_kg", 0.5),
            "length": pkg.get("length_cm", 10.0),
            "breadth": pkg.get("breadth_cm", 10.0),
            "height": pkg.get("height_cm", 10.0),
            "declared_value": order["grand_total"]["amount_minor"] / 100,
            "items": [{"name": line.get("title") or line.get("product_title") or "Item", "quantity": line.get("quantity", 1),
                       "price": line["unit_price"]["amount_minor"] / 100} for line in order.get("lines", [])],
        })

        updated_shipment = await store.get(self.pg, id=shipment_id)

        # Discover options
        valid, rejected = await self.discover_options(
            shipment_id=shipment_id,
            pickup_pincode=pickup["pincode"],
            delivery_pincode=address.get("postal_code", ""),
            weight_kg=pkg.get("weight_kg", 0.5),
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

        result = await store.get(self.pg, id=shipment_id)
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

        shipment = await store.get(self.pg, id=shipment_id)
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
        updated = await store.get(self.pg, id=shipment_id)
        return {"status": "booked" if success else "failed", "shipment": updated}

    # ── Tracking sync ─────────────────────────────────────────────────────────

    async def sync_tracking(self, shipment_id: str) -> dict:
        shipment = await store.get(self.pg, id=shipment_id)
        if not shipment or not shipment.get("awb"):
            return {"error": "No AWB found"}

        provider = get_provider(shipment.get("selected_provider", ""))
        if not provider:
            return {"error": "Provider not found"}

        result = await provider.track_shipment(shipment["awb"])

        # Persist new events
        existing_events = {e.get("event_time") for e in shipment.get("tracking_events", [])}
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
            await store.append(self.pg, shipment_id, "tracking_events", new_events)

        await apply_courier_status(self.pg, shipment, result.current_status)

        return {"awb": shipment["awb"], "current_status": result.current_status, "new_events": len(new_events)}
