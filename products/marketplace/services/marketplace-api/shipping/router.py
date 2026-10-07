from fastapi import APIRouter, Depends, HTTPException, Body
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
from pydantic import BaseModel

from core.deps import db_dep, current_user, seller_only, admin_only
from shipping.service import ShippingService
from shipping.schemas import (
    PickupLocationCreate, PickupLocationDoc,
    DiscoverOptionsRequest, ManualBookRequest, ShipmentStatus,
)

router = APIRouter(prefix="/shipping", tags=["shipping"])


def get_service(db: AsyncIOMotorDatabase = Depends(db_dep)) -> ShippingService:
    return ShippingService(db)


# ── Pickup Locations ──────────────────────────────────────────────────────────

@router.get("/pickup-locations")
async def list_pickup_locations(user=Depends(current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    seller_id = user["id"] if user["role"] != "admin" else None
    q = {"seller_id": seller_id} if seller_id else {}
    return await db.seller_pickup_locations.find(q, {"_id": 0}).to_list(50)


@router.post("/pickup-locations")
async def create_pickup_location(data: PickupLocationCreate, user=Depends(seller_only), db: AsyncIOMotorDatabase = Depends(db_dep)):
    # If this is default, unset others
    if data.is_default:
        await db.seller_pickup_locations.update_many({"seller_id": user["id"]}, {"$set": {"is_default": False}})
    doc = PickupLocationDoc(seller_id=user["id"], **data.model_dump())
    await db.seller_pickup_locations.insert_one(doc.model_dump())
    return doc.model_dump()


@router.put("/pickup-locations/{loc_id}")
async def update_pickup_location(loc_id: str, data: dict = Body(...), user=Depends(current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    fq = {"id": loc_id} if user["role"] == "admin" else {"id": loc_id, "seller_id": user["id"]}
    if data.get("is_default"):
        await db.seller_pickup_locations.update_many({"seller_id": user["id"]}, {"$set": {"is_default": False}})
    from shipping.schemas import now_iso
    data["updated_at"] = now_iso()
    await db.seller_pickup_locations.update_one(fq, {"$set": data})
    return {"message": "Updated"}


@router.delete("/pickup-locations/{loc_id}")
async def delete_pickup_location(loc_id: str, user=Depends(current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    fq = {"id": loc_id} if user["role"] == "admin" else {"id": loc_id, "seller_id": user["id"]}
    await db.seller_pickup_locations.delete_one(fq)
    return {"message": "Deleted"}


# ── Ready to Ship trigger ─────────────────────────────────────────────────────

class ReadyToShipRequest(BaseModel):
    pickup_location_id: Optional[str] = None
    weight_kg: float = 0.5
    length_cm: float = 10.0
    breadth_cm: float = 10.0
    height_cm: float = 10.0


@router.post("/orders/{order_id}/ready-to-ship")
async def ready_to_ship(order_id: str, req: ReadyToShipRequest, user=Depends(seller_only), svc: ShippingService = Depends(get_service)):
    result = await svc.trigger_ready_to_ship(
        order_id=order_id, seller_id=user["id"],
        pickup_location_id=req.pickup_location_id,
        package_details={"weight_kg": req.weight_kg, "length_cm": req.length_cm, "breadth_cm": req.breadth_cm, "height_cm": req.height_cm},
    )
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result


# ── Option discovery ──────────────────────────────────────────────────────────

@router.post("/orders/{order_id}/discover-options")
async def discover_options(order_id: str, req: DiscoverOptionsRequest, user=Depends(current_user), svc: ShippingService = Depends(get_service), db: AsyncIOMotorDatabase = Depends(db_dep)):
    shipment = await svc.get_or_create_shipment(order_id)
    if not shipment:
        raise HTTPException(404, "Order not found")
    pickup = None
    if req.pickup_location_id:
        pickup = await db.seller_pickup_locations.find_one({"id": req.pickup_location_id}, {"_id": 0})
    if not pickup:
        pickup = await svc.get_default_pickup(user["id"])
    if not pickup:
        raise HTTPException(400, "No pickup location configured")
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    valid, rejected = await svc.discover_options(
        shipment_id=shipment["id"],
        pickup_pincode=pickup["pincode"],
        delivery_pincode=order.get("delivery_pincode", ""),
        weight_kg=req.package_weight,
    )
    return {"valid": [o.model_dump() for o in valid], "rejected": [o.model_dump() for o in rejected], "shipment_id": shipment["id"]}


@router.get("/orders/{order_id}/options")
async def get_options(order_id: str, user=Depends(current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    shipment = await db.shipments.find_one({"order_id": order_id}, {"_id": 0})
    if not shipment:
        raise HTTPException(404, "No shipment found for this order")
    options = await db.shipment_options.find({"shipment_id": shipment["id"]}, {"_id": 0}).sort("ranking_position", 1).to_list(50)
    return {"options": options, "shipment": shipment}


# ── Manual booking ────────────────────────────────────────────────────────────

@router.post("/orders/{order_id}/manual-book")
async def manual_book(order_id: str, req: ManualBookRequest, user=Depends(current_user), svc: ShippingService = Depends(get_service), db: AsyncIOMotorDatabase = Depends(db_dep)):
    shipment = await db.shipments.find_one({"order_id": order_id}, {"_id": 0})
    if not shipment:
        raise HTTPException(404, "No shipment found")
    result = await svc.manual_book(shipment["id"], order_id, req.provider, req.service_code, req.courier_name)
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result


# ── Shipment operations ───────────────────────────────────────────────────────

@router.get("/shipments/{shipment_id}")
async def get_shipment(shipment_id: str, user=Depends(current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    fq = {"id": shipment_id}
    if user["role"] not in ["admin"]:
        fq["$or"] = [{"seller_id": user["id"]}, {"buyer_id": user["id"]}]
    s = await db.shipments.find_one(fq, {"_id": 0})
    if not s:
        raise HTTPException(404, "Shipment not found")
    events = await db.shipment_tracking_events.find({"shipment_id": shipment_id}, {"_id": 0}).sort("event_time", -1).to_list(50)
    options = await db.shipment_options.find({"shipment_id": shipment_id}, {"_id": 0}).sort("ranking_position", 1).to_list(20)
    attempts = await db.shipment_booking_attempts.find({"shipment_id": shipment_id}, {"_id": 0}).to_list(20)
    return {"shipment": s, "tracking_events": events, "options": options, "booking_attempts": attempts}


@router.get("/track/{awb}")
async def track_by_awb(awb: str, user=Depends(current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    shipment = await db.shipments.find_one({"awb": awb}, {"_id": 0})
    if not shipment:
        raise HTTPException(404, "AWB not found")
    from shipping.service import get_provider
    provider = get_provider(shipment.get("selected_provider", ""))
    if not provider:
        raise HTTPException(400, "Provider not available")
    result = await provider.track_shipment(awb)
    return {"awb": awb, "current_status": result.current_status, "events": result.events}


@router.post("/shipments/{shipment_id}/request-pickup")
async def request_pickup(shipment_id: str, user=Depends(current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    s = await db.shipments.find_one({"id": shipment_id}, {"_id": 0})
    if not s or not s.get("awb"):
        raise HTTPException(400, "Shipment not booked yet")
    from shipping.service import get_provider
    provider = get_provider(s.get("selected_provider", ""))
    if not provider:
        raise HTTPException(400, "Provider not available")
    result = await provider.request_pickup(s["awb"])
    if result.get("supported"):
        await db.shipments.update_one({"id": shipment_id}, {"$set": {"current_status": ShipmentStatus.PICKUP_REQUESTED}})
    return result


@router.post("/shipments/{shipment_id}/cancel")
async def cancel_shipment(shipment_id: str, user=Depends(current_user), db: AsyncIOMotorDatabase = Depends(db_dep)):
    s = await db.shipments.find_one({"id": shipment_id}, {"_id": 0})
    if not s or not s.get("awb"):
        raise HTTPException(400, "No AWB to cancel")
    from shipping.service import get_provider
    provider = get_provider(s.get("selected_provider", ""))
    result = await provider.cancel_shipment(s["awb"]) if provider else {"supported": False}
    await db.shipments.update_one({"id": shipment_id}, {"$set": {"current_status": ShipmentStatus.CANCELLED}})
    return result


@router.post("/shipments/{shipment_id}/retry-booking")
async def retry_booking(shipment_id: str, user=Depends(current_user), svc: ShippingService = Depends(get_service), db: AsyncIOMotorDatabase = Depends(db_dep)):
    s = await db.shipments.find_one({"id": shipment_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Shipment not found")
    # Re-run discovery and booking
    options = await db.shipment_options.find({"shipment_id": shipment_id, "rejected_reason": None}, {"_id": 0}).sort("ranking_position", 1).to_list(20)
    from shipping.schemas import CourierOption
    valid = [CourierOption(**o) for o in options]
    if not valid:
        raise HTTPException(400, "No valid options to retry with. Run discover-options first.")
    success = await svc.auto_book(shipment_id, s["order_id"], valid, s)
    updated = await db.shipments.find_one({"id": shipment_id}, {"_id": 0})
    return {"status": "booked" if success else "failed", "shipment": updated}


@router.post("/sync/{shipment_id}")
async def sync_tracking(shipment_id: str, user=Depends(current_user), svc: ShippingService = Depends(get_service)):
    return await svc.sync_tracking(shipment_id)


# ── Admin endpoints ───────────────────────────────────────────────────────────

@router.get("/admin/shipments")
async def admin_all_shipments(user=Depends(admin_only), db: AsyncIOMotorDatabase = Depends(db_dep)):
    shipments = await db.shipments.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return shipments


@router.get("/admin/shipments/attention-required")
async def attention_required(user=Depends(admin_only), db: AsyncIOMotorDatabase = Depends(db_dep)):
    shipments = await db.shipments.find({"shipping_attention_required": True}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return shipments


@router.get("/admin/shipments/stats")
async def shipping_stats(user=Depends(admin_only), db: AsyncIOMotorDatabase = Depends(db_dep)):
    return {
        "total":              await db.shipments.count_documents({}),
        "booked":             await db.shipments.count_documents({"current_status": ShipmentStatus.BOOKED}),
        "in_transit":         await db.shipments.count_documents({"current_status": ShipmentStatus.IN_TRANSIT}),
        "delivered":          await db.shipments.count_documents({"current_status": ShipmentStatus.DELIVERED}),
        "attention_required": await db.shipments.count_documents({"shipping_attention_required": True}),
        "cancelled":          await db.shipments.count_documents({"current_status": ShipmentStatus.CANCELLED}),
    }
