import logging
import hmac
import hashlib
import json
import uuid
from fastapi import APIRouter, Request, HTTPException
from fastapi import Depends
from core.config import settings
from shared.database.postgres import pg_conn_dep
from shipping import store
from shipping.schemas import TrackingEventDoc, apply_courier_status

router = APIRouter(prefix="/webhooks/shipping", tags=["shipping-webhooks"])
logger = logging.getLogger("zolexora.shipping.webhooks")



SIGNATURE_HEADERS = (
    "x-shipping-signature",
    "x-webhook-signature",
    "x-shiprocket-signature",
    "x-delhivery-signature",
    "x-nimbuspost-signature",
    "x-pickrr-signature",
    "x-dtdc-signature",
    "x-bluedart-signature",
    "x-indiapost-signature",
)


async def _verified_payload(request: Request) -> dict:
    secret = settings.SHIPPING_WEBHOOK_SECRET
    if not secret:
        logger.error("Shipping webhook rejected: SHIPPING_WEBHOOK_SECRET is not configured")
        raise HTTPException(503, "Shipping webhook verification is not configured")

    body = await request.body()
    provided = next((request.headers.get(h) for h in SIGNATURE_HEADERS if request.headers.get(h)), "")
    if not provided:
        raise HTTPException(401, "Missing shipping webhook signature")

    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    normalized = provided.strip()
    if normalized.startswith("sha256="):
        normalized = normalized.removeprefix("sha256=")
    if not hmac.compare_digest(expected, normalized):
        raise HTTPException(401, "Invalid shipping webhook signature")

    try:
        return json.loads(body.decode("utf-8") or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(400, "Invalid JSON payload") from exc

async def _save_event(pg, awb: str, provider: str, status: str, description: str, location: str, raw: dict):
    s = await store.get(pg, awb=awb)
    if not s:
        logger.warning(f"Webhook: AWB {awb} not found in DB")
        return
    event = TrackingEventDoc(
        shipment_id=s["id"], provider=provider, awb=awb,
        status=status, description=description, location=location,
        raw_payload=raw,
    )
    async with pg.transaction():
        # A replayed delivery is ignored.
        if await pg.fetchval("SELECT details -> 'tracking_events' @> jsonb_build_array(jsonb_build_object('raw_payload', $2::jsonb)) FROM shipment WHERE id = $1",
                             uuid.UUID(s["id"]), json.dumps(raw)):
            return
        await store.append(pg, s["id"], "tracking_events", [event.model_dump()])
        mapped = await apply_courier_status(pg, s, status)
    logger.info(f"Webhook [{provider}] AWB={awb} status={mapped}")


@router.post("/delhivery")
async def delhivery_webhook(request: Request, pg=Depends(pg_conn_dep)):
    data = await _verified_payload(request)
    packages = data.get("packages", [data])
    for pkg in packages:
        awb = pkg.get("waybill") or pkg.get("awb")
        status = pkg.get("status") or pkg.get("Status", "")
        location = pkg.get("city") or pkg.get("Location", "")
        if awb:
            await _save_event(pg, awb, "delhivery", status, status, location, pkg)
    return {"status": "ok"}


@router.post("/nimbuspost")
async def nimbuspost_webhook(request: Request, pg=Depends(pg_conn_dep)):
    data = await _verified_payload(request)
    awb = data.get("awb_number") or data.get("awb")
    status = data.get("status", "")
    location = data.get("current_location", "")
    if awb:
        await _save_event(pg, awb, "nimbuspost", status, data.get("description", status), location, data)
    return {"status": "ok"}


@router.post("/shiprocket")
async def shiprocket_webhook(request: Request, pg=Depends(pg_conn_dep)):
    data = await _verified_payload(request)
    awb = data.get("awb") or data.get("awb_code")
    status = data.get("current_status") or data.get("status", "")
    location = data.get("shipment_city") or data.get("location", "")
    if awb:
        await _save_event(pg, awb, "shiprocket", status, status, location, data)
    return {"status": "ok"}


@router.post("/pickrr")
async def pickrr_webhook(request: Request, pg=Depends(pg_conn_dep)):
    data = await _verified_payload(request)
    awb = data.get("tracking_id") or data.get("awb")
    status = data.get("current_status_description") or data.get("status", "")
    location = data.get("current_location", "")
    if awb:
        await _save_event(pg, awb, "pickrr", status, status, location, data)
    return {"status": "ok"}


@router.post("/dtdc")
async def dtdc_webhook(request: Request, pg=Depends(pg_conn_dep)):
    data = await _verified_payload(request)
    awb = data.get("consignmentNumber") or data.get("awb")
    status = data.get("status", "")
    location = data.get("city", "")
    if awb:
        await _save_event(pg, awb, "dtdc", status, status, location, data)
    return {"status": "ok"}


@router.post("/bluedart")
async def bluedart_webhook(request: Request, pg=Depends(pg_conn_dep)):
    data = await _verified_payload(request)
    awb = data.get("AWBNo") or data.get("waybillNumber")
    status = data.get("ScanType") or data.get("status", "")
    location = data.get("ScannedLocation", "")
    if awb:
        await _save_event(pg, awb, "bluedart", status, status, location, data)
    return {"status": "ok"}


@router.post("/indiapost")
async def indiapost_webhook(request: Request, pg=Depends(pg_conn_dep)):
    data = await _verified_payload(request)
    awb = data.get("consignment_number") or data.get("tracking_number")
    status = data.get("current_status", "")
    location = data.get("current_location", "")
    if awb:
        await _save_event(pg, awb, "indiapost", status, status, location, data)
    return {"status": "ok"}
