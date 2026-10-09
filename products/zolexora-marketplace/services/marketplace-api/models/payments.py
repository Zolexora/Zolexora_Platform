from enum import Enum
from typing import Optional, List, Dict, Any, Literal
from pydantic import Field, model_validator
from .base import APIModel
from .primitives import EntityId, Money, UTCDateTime
import uuid

class PaymentMethodType(str, Enum):
    card = "card"
    upi = "upi"
    net_banking = "net_banking"
    wallet = "wallet"
    cash_on_delivery = "cash_on_delivery"

class PaymentIntentStatus(str, Enum):
    created = "created"
    requires_action = "requires_action"
    processing = "processing"
    authorized = "authorized"
    captured = "captured"
    failed = "failed"
    cancelled = "cancelled"
    partially_refunded = "partially_refunded"
    refunded = "refunded"

class NextActionType(str, Enum):
    redirect = "redirect"
    display_qr = "display_qr"
    open_upi_app = "open_upi_app"
    wait = "wait"
    none = "none"

class NextAction(APIModel):
    type: NextActionType
    # A validated URL for redirection
    redirect_url: Optional[str] = None
    # Text or image reference for QR
    qr_data: Optional[str] = None
    # Generic instructions to present to the user
    instructions: Optional[List[str]] = None

class RefundSummary(APIModel):
    total_refunded: Money
    latest_refund_at: Optional[UTCDateTime] = None

class PaymentIntent(APIModel):
    """
    A canonical, provider-neutral public payment intent contract.
    No provider-specific metadata or credentials are included here.
    """
    id: EntityId = Field(default_factory=lambda: str(uuid.uuid4()))
    storefront_id: EntityId
    order_id: Optional[EntityId] = None
    checkout_session_id: Optional[EntityId] = None
    amount: Money
    status: PaymentIntentStatus = PaymentIntentStatus.created
    payment_method_type: Optional[PaymentMethodType] = None
    next_action: Optional[NextAction] = None
    idempotency_key: Optional[str] = None
    created_at: UTCDateTime
    updated_at: UTCDateTime
    version: int = 1

    def transition_to(self, new_status: PaymentIntentStatus):
        # Legal state transitions
        legal_transitions = {
            PaymentIntentStatus.created: {
                PaymentIntentStatus.requires_action, 
                PaymentIntentStatus.processing, 
                PaymentIntentStatus.authorized, 
                PaymentIntentStatus.cancelled,
                PaymentIntentStatus.failed
            },
            PaymentIntentStatus.requires_action: {
                PaymentIntentStatus.processing,
                PaymentIntentStatus.authorized,
                PaymentIntentStatus.failed,
                PaymentIntentStatus.cancelled
            },
            PaymentIntentStatus.processing: {
                PaymentIntentStatus.authorized,
                PaymentIntentStatus.failed
            },
            PaymentIntentStatus.authorized: {
                PaymentIntentStatus.captured,
                PaymentIntentStatus.failed,
                PaymentIntentStatus.cancelled
            },
            PaymentIntentStatus.captured: {
                PaymentIntentStatus.partially_refunded,
                PaymentIntentStatus.refunded
            },
            PaymentIntentStatus.partially_refunded: {
                PaymentIntentStatus.partially_refunded,
                PaymentIntentStatus.refunded
            },
            PaymentIntentStatus.failed: set(),
            PaymentIntentStatus.cancelled: set(),
            PaymentIntentStatus.refunded: set(),
        }
        if new_status not in legal_transitions[self.status]:
            raise ValueError(f"Illegal state transition from {self.status.value} to {new_status.value}")
        self.status = new_status
        self.version += 1

    @model_validator(mode='after')
    def validate_next_action(self):
        if self.next_action:
            if self.next_action.type == NextActionType.redirect and not self.next_action.redirect_url:
                raise ValueError("redirect_url is required for redirect action")
            if self.next_action.type == NextActionType.display_qr and not self.next_action.qr_data:
                raise ValueError("qr_data is required for display_qr action")
        return self

class InternalProviderMetadata(APIModel):
    """
    Internal-only model to map a marketplace PaymentIntent to a provider transaction.
    This must NEVER be returned in public API responses.
    """
    payment_intent_id: EntityId
    provider_name: Literal["razorpay", "upi_manual"]
    provider_order_id: Optional[str] = None
    provider_payment_id: Optional[str] = None
    raw_payload: Optional[Dict[str, Any]] = None

# Legacy razorpay compatibility request
class LegacyRazorpayVerifyRequest(APIModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
