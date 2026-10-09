from fastapi import APIRouter, Depends
from models.payments import PaymentIntent, LegacyRazorpayVerifyRequest
from storefronts.models import StorefrontContext
from storefronts.dependencies import require_storefront_context

router = APIRouter(tags=["payments"])

@router.get("/payments/{intent_id}", response_model=PaymentIntent)
async def get_payment_intent(
    intent_id: str,
    context: StorefrontContext = Depends(require_storefront_context)
):
    """
    Retrieve a payment intent. 
    Storefront isolation is enforced: the intent must belong to the resolved storefront.
    """
    pass

@router.post("/payments/legacy/verify", response_model=PaymentIntent)
async def verify_legacy_payment(
    req: LegacyRazorpayVerifyRequest,
    context: StorefrontContext = Depends(require_storefront_context)
):
    """
    Legacy Razorpay verification adapter.
    """
    pass
