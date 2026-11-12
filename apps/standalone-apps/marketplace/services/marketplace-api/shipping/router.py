from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Optional
from pydantic import BaseModel

from core.deps import current_user, seller_only, admin_only, is_admin
from commerce import orders as order_store
from shared.database.postgres import pg_conn_dep
from shipping import store
from shipping.service import ShippingService, get_provider
from shipping.schemas import (
    CourierOption, PickupLocationCreate,
    DiscoverOptionsRequest, ManualBookRequest, ShipmentStatus,
)

router = APIRouter(prefix="/shipping", tags=["shipping"])
_RECORDS = ("options", "booking_attempts", "tracking_events")  # listed on their own, not in the shipment


def get_service(pg=Depends(pg_conn_dep)) -> ShippingService:
    return ShippingService(pg)


def _org(user: dict) -> Optional[str]:
    """The caller's seller organisation; None for an admin (who sees every organisation)."""
    return None if is_admin(user) else user.get("seller_org_id")


def _shipment(s: dict) -> dict:
    return {k: v for k, v in s.items() if k not in _RECORDS}


async def _owned_order(pg, order_id: str, user: dict) -> dict:
    """The order, if the caller is its seller (or an admin). 404 otherwise, so ids don't leak."""
    if not is_admin(user) and not user.get("seller_org_id"):
        raise HTTPException(404, "Order not found")
    order = await order_store.get(pg, id=order_id, seller_id=_org(user))
    if not order:
        raise HTTPException(404, "Order not found")
    return order


async def _owned_shipment(pg, shipment_id: str, user: dict) -> dict:
    """The shipment, if the caller is its seller (or an admin)."""
    if not is_admin(user) and not user.get("seller_org_id"):
        raise HTTPException(404, "Shipment not found")
    shipment = await store.get(pg, id=shipment_id, seller_id=_org(user))
    if not shipment:
        raise HTTPException(404, "Shipment not found")
    return shipment


async def _visible_shipment(pg, user: dict, **q) -> Optional[dict]:
    """A shipment the caller bought, sells, or (admin) any shipment."""
    return await store.get(pg, **q, party=None if is_admin(user) else (user["id"], user.get("seller_org_id")))


# ── Pickup Locations ──────────────────────────────────────────────────────────

@router.get("/pickup-locations")
async def list_pickup_locations(user=Depends(current_user), pg=Depends(pg_conn_dep)):
    if not is_admin(user) and not user.get("seller_org_id"):
        return []
    return await store.pickups(pg, _org(user))


@router.post("/pickup-locations")
async def create_pickup_location(data: PickupLocationCreate, user=Depends(seller_only), pg=Depends(pg_conn_dep)):
    if not user.get("seller_org_id"):
        raise HTTPException(400, "Choose the organisation the pickup address belongs to")
    return await store.add_pickup(pg, user["seller_org_id"], data.model_dump())


@router.put("/pickup-locations/{loc_id}")
async def update_pickup_location(loc_id: str, data: dict = Body(...), user=Depends(seller_only), pg=Depends(pg_conn_dep)):
    loc = await store.pickup(pg, _org(user), loc_id) if is_admin(user) or user.get("seller_org_id") else None
    if not loc:
        raise HTTPException(404, "Pickup location not found")
    # Only address fields may change; id and organisation stay as they are.
    changes = {k: v for k, v in data.items() if k in PickupLocationCreate.model_fields}
    if changes:
        changes = PickupLocationCreate(**{**loc, **changes}).model_dump(include=set(changes))
    await store.update_pickup(pg, loc, changes)
    return {"message": "Updated"}


@router.delete("/pickup-locations/{loc_id}")
async def delete_pickup_location(loc_id: str, user=Depends(seller_only), pg=Depends(pg_conn_dep)):
    if is_admin(user) or user.get("seller_org_id"):
        await store.delete_pickup(pg, _org(user), loc_id)
    return {"message": "Deleted"}


# ── Ready to Ship trigger ─────────────────────────────────────────────────────

class ReadyToShipRequest(BaseModel):
    pickup_location_id: Optional[str] = None
    weight_kg: float = 0.5
    length_cm: float = 10.0
    breadth_cm: float = 10.0
    height_cm: float = 10.0


@router.post("/orders/{order_id}/ready-to-ship")
async def ready_to_ship(order_id: str, req: ReadyToShipRequest, user=Depends(seller_only), svc: ShippingService = Depends(get_service), pg=Depends(pg_conn_dep)):
    order = await _owned_order(pg, order_id, user)
    result = await svc.trigger_ready_to_ship(
        order_id=order_id, seller_id=order["seller_id"],
        pickup_location_id=req.pickup_location_id,
        package_details={"weight_kg": req.weight_kg, "length_cm": req.length_cm, "breadth_cm": req.breadth_cm, "height_cm": req.height_cm},
    )
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result


# ── Option discovery ──────────────────────────────────────────────────────────

@router.post("/orders/{order_id}/discover-options")
async def discover_options(order_id: str, req: DiscoverOptionsRequest, user=Depends(seller_only), svc: ShippingService = Depends(get_service), pg=Depends(pg_conn_dep)):
    order = await _owned_order(pg, order_id, user)
    shipment = await svc.get_or_create_shipment(order_id)
    if not shipment:
        raise HTTPException(404, "Order not found")
    pickup = None
    if req.pickup_location_id:
        pickup = await store.pickup(pg, order["seller_id"], req.pickup_location_id)
    if not pickup:
        pickup = await svc.get_default_pickup(order["seller_id"])
    if not pickup:
        raise HTTPException(400, "No pickup location configured")
    valid, rejected = await svc.discover_options(
        shipment_id=shipment["id"],
        pickup_pincode=pickup["pincode"],
        delivery_pincode=(order.get("shipping_address") or {}).get("postal_code", ""),
        weight_kg=req.package_weight,
    )
    return {"valid": [o.model_dump() for o in valid], "rejected": [o.model_dump() for o in rejected], "shipment_id": shipment["id"]}


@router.get("/orders/{order_id}/options")
async def get_options(order_id: str, user=Depends(seller_only), pg=Depends(pg_conn_dep)):
    await _owned_order(pg, order_id, user)
    shipment = await store.get(pg, order_id=order_id)
    if not shipment:
        raise HTTPException(404, "No shipment found for this order")
    return {"options": shipment.get("options", []), "shipment": _shipment(shipment)}


# ── Manual booking ────────────────────────────────────────────────────────────

@router.post("/orders/{order_id}/manual-book")
async def manual_book(order_id: str, req: ManualBookRequest, user=Depends(seller_only), svc: ShippingService = Depends(get_service), pg=Depends(pg_conn_dep)):
    await _owned_order(pg, order_id, user)
    shipment = await store.get(pg, order_id=order_id)
    if not shipment:
        raise HTTPException(404, "No shipment found")
    result = await svc.manual_book(shipment["id"], order_id, req.provider, req.service_code, req.courier_name)
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result


# ── Shipment operations ───────────────────────────────────────────────────────

@router.get("/shipments/{shipment_id}")
async def get_shipment(shipment_id: str, user=Depends(current_user), pg=Depends(pg_conn_dep)):
    s = await _visible_shipment(pg, user, id=shipment_id)
    if not s:
        raise HTTPException(404, "Shipment not found")
    events = sorted(s.get("tracking_events", []), key=lambda e: e.get("event_time", ""), reverse=True)
    return {"shipment": _shipment(s), "tracking_events": events, "options": s.get("options", []),
            "booking_attempts": s.get("booking_attempts", [])}


@router.get("/track/{awb}")
async def track_by_awb(awb: str, user=Depends(current_user), pg=Depends(pg_conn_dep)):
    shipment = await _visible_shipment(pg, user, awb=awb)
    if not shipment:
        raise HTTPException(404, "AWB not found")
    provider = get_provider(shipment.get("selected_provider", ""))
    if not provider:
        raise HTTPException(400, "Provider not available")
    result = await provider.track_shipment(awb)
    return {"awb": awb, "current_status": result.current_status, "events": result.events}


@router.post("/shipments/{shipment_id}/request-pickup")
async def request_pickup(shipment_id: str, user=Depends(seller_only), pg=Depends(pg_conn_dep)):
    s = await _owned_shipment(pg, shipment_id, user)
    if not s.get("awb"):
        raise HTTPException(400, "Shipment not booked yet")
    provider = get_provider(s.get("selected_provider", ""))
    if not provider:
        raise HTTPException(400, "Provider not available")
    result = await provider.request_pickup(s["awb"])
    if result.get("supported"):
        await store.update(pg, shipment_id, {"current_status": ShipmentStatus.PICKUP_REQUESTED})
    return result


@router.post("/shipments/{shipment_id}/cancel")
async def cancel_shipment(shipment_id: str, user=Depends(seller_only), pg=Depends(pg_conn_dep)):
    s = await _owned_shipment(pg, shipment_id, user)
    if not s.get("awb"):
        raise HTTPException(400, "No AWB to cancel")
    provider = get_provider(s.get("selected_provider", ""))
    result = await provider.cancel_shipment(s["awb"]) if provider else {"supported": False}
    await store.update(pg, shipment_id, {"current_status": ShipmentStatus.CANCELLED})
    return result


@router.post("/shipments/{shipment_id}/retry-booking")
async def retry_booking(shipment_id: str, user=Depends(seller_only), svc: ShippingService = Depends(get_service), pg=Depends(pg_conn_dep)):
    s = await _owned_shipment(pg, shipment_id, user)
    # Book again with the options found last time, best first
    options = sorted((o for o in s.get("options", []) if o.get("rejected_reason") is None),
                     key=lambda o: o.get("ranking_position") or 0)
    valid = [CourierOption(**o) for o in options]
    if not valid:
        raise HTTPException(400, "No valid options to retry with. Run discover-options first.")
    success = await svc.auto_book(shipment_id, s["order_id"], valid, s)
    return {"status": "booked" if success else "failed", "shipment": _shipment(await store.get(pg, id=shipment_id))}


@router.post("/sync/{shipment_id}")
async def sync_tracking(shipment_id: str, user=Depends(current_user), svc: ShippingService = Depends(get_service), pg=Depends(pg_conn_dep)):
    if not await _visible_shipment(pg, user, id=shipment_id):
        raise HTTPException(404, "Shipment not found")
    return await svc.sync_tracking(shipment_id)


# ── Admin endpoints ───────────────────────────────────────────────────────────

@router.get("/admin/shipments")
async def admin_all_shipments(user=Depends(admin_only), pg=Depends(pg_conn_dep)):
    return [_shipment(s) for s in await store.find(pg)]


@router.get("/admin/shipments/attention-required")
async def attention_required(user=Depends(admin_only), pg=Depends(pg_conn_dep)):
    return [_shipment(s) for s in await store.find(pg, attention=True, limit=100)]


@router.get("/admin/shipments/stats")
async def shipping_stats(user=Depends(admin_only), pg=Depends(pg_conn_dep)):
    return {
        "total":              await store.count(pg),
        "booked":             await store.count(pg, current_status=ShipmentStatus.BOOKED),
        "in_transit":         await store.count(pg, current_status=ShipmentStatus.IN_TRANSIT),
        "delivered":          await store.count(pg, current_status=ShipmentStatus.DELIVERED),
        "attention_required": await store.count(pg, attention=True),
        "cancelled":          await store.count(pg, current_status=ShipmentStatus.CANCELLED),
    }
