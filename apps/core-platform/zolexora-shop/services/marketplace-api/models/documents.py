"""
MongoDB Atlas document models.

Storage split
─────────────
Cloudinary       → ALL binary media (product images, reel videos, avatars)
Supabase PG      → users, subscriptions, payment_transactions
MongoDB Atlas    → products, orders, cart, reels, reel_views,
                   coin_transactions, shipments + sub-collections,
                   seller_pickup_locations, pending_registrations,
                   password_resets, discount_codes
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, Field

def now_iso(): return datetime.now(timezone.utc).isoformat()
def new_id():  return str(uuid.uuid4())


class UserDoc(BaseModel):
    id:                      str  = Field(default_factory=new_id)
    email:                   str
    name:                    str
    role:                    str  = "viewer"
    loyalty_balance:         int  = 0
    coin_balance:            int  = Field(0, json_schema_extra={"deprecated": True})
    subscription_plan:       Optional[str] = None
    subscription_expires_at: Optional[str] = None
    is_active:               bool = True
    is_email_verified:       bool = False
    auth_provider:           str  = "email"   # email | google
    picture:                 Optional[str] = None  # Cloudinary CDN URL
    created_at:              str  = Field(default_factory=now_iso)


class ReelDoc(BaseModel):
    id:               str  = Field(default_factory=new_id)
    storefront_id:    str
    creator_id:       str
    creator_name:     str
    title:            str
    description:      str  = ""
    video_url:        Optional[str] = None   # Cloudinary CDN URL
    thumbnail_url:    Optional[str] = None   # Cloudinary CDN URL
    media_type:       str  = "image"
    content_type:     str  = "organic"
    linked_product_id: Optional[str] = None
    sponsor_data:     Optional[dict] = None
    is_active:        bool = True
    views_count:      int  = 0
    likes_count:      int  = 0
    created_at:       str  = Field(default_factory=now_iso)





class OrderItemDoc(BaseModel):
    product_id:    str
    product_title: str
    price:         float
    quantity:      int
    image:         Optional[str] = None


class OrderDoc(BaseModel):
    id:           str  = Field(default_factory=new_id)
    storefront_id: str
    buyer_id:     str
    buyer_name:   str
    seller_id:    str
    seller_name:  str
    items:        List[OrderItemDoc]
    subtotal:     float
    
    # Provider-neutral promotion/loyalty adjustments
    loyalty_points_used: int = 0
    loyalty_discount: float = 0.0
    
    # Deprecated legacy fields
    coins_used:   int   = Field(0, json_schema_extra={"deprecated": True})
    coins_discount: float = Field(0.0, json_schema_extra={"deprecated": True})
    
    total_paid:   float = 0.0

    # payment_method: razorpay | upi | coins
    payment_method: str = "razorpay"
    # payment_status: pending | awaiting_verification | paid | failed
    payment_status: str = "pending"

    razorpay_order_id:   Optional[str] = Field(default=None, json_schema_extra={"deprecated": True})
    razorpay_payment_id: Optional[str] = Field(default=None, json_schema_extra={"deprecated": True})

    # UPI manual verification
    upi_transaction_ref: Optional[str] = None
    upi_verified_by:     Optional[str] = None
    upi_verified_at:     Optional[str] = None

    # Delivery address (collected at checkout)
    delivery_name:    Optional[str] = None
    delivery_phone:   Optional[str] = None
    delivery_email:   Optional[str] = None
    delivery_address: Optional[str] = None
    delivery_city:    Optional[str] = None
    delivery_state:   Optional[str] = None
    delivery_pincode: Optional[str] = None

    status:     str = "pending"
    admin_note: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class CoinTxDoc(BaseModel):
    id:          str = Field(default_factory=new_id)
    user_id:     str
    amount:      int
    type:        str
    description: str
    ref_id:      Optional[str] = None
    created_at:  str = Field(default_factory=now_iso)


class PendingRegDoc(BaseModel):
    id:            str = Field(default_factory=new_id)
    email:         str
    name:          str
    role:          str
    password_hash: str
    otp:           str
    otp_attempts:  int = 0
    expires_at:    str
    created_at:    str = Field(default_factory=now_iso)
