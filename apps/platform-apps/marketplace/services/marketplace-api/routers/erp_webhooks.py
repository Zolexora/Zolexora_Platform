from fastapi import APIRouter, Request, HTTPException
from core.config import settings
from integrations.zolexora_erp.adapter import SignedWebhookReceiver
from integrations.zolexora_erp.contracts import EventEnvelope

router = APIRouter(prefix="/erp", tags=["ERP Webhooks"])

# The HMAC secret comes from Infisical (ERP_WEBHOOK_SECRET); without it the endpoint is off.
webhook_receiver = SignedWebhookReceiver(secret=settings.ERP_WEBHOOK_SECRET)

@router.post("/webhooks")
async def process_erp_webhook(request: Request):
    if not webhook_receiver.secret:
        raise HTTPException(status_code=503, detail="ERP webhooks are not configured")
    payload = await request.body()
    signature = request.headers.get("x-erp-signature")
    
    if not signature:
        raise HTTPException(status_code=400, detail="Missing signature")
        
    if not webhook_receiver.verify_signature(payload, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")
        
    try:
        import json
        data = json.loads(payload)
        event = EventEnvelope.model_validate(data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid payload")
        
    await webhook_receiver.process(event)
    return {"status": "accepted"}
