import uuid
import hashlib
import json
from datetime import datetime, timezone, timedelta
from typing import Any

from .schemas import CheckoutQuoteCreate, CheckoutQuoteResponse, QuoteLineItem

class StaleQuoteError(Exception):
    pass

class CheckoutQuoteService:
    def __init__(self, cart_repo: Any, pricing_svc: Any, inventory_svc: Any, tax_svc: Any, promo_svc: Any, quote_repo: Any):
        self.cart_repo = cart_repo
        self.pricing_svc = pricing_svc
        self.inventory_svc = inventory_svc
        self.tax_svc = tax_svc
        self.promo_svc = promo_svc
        self.quote_repo = quote_repo

    async def generate_quote(self, request: CheckoutQuoteCreate) -> CheckoutQuoteResponse:
        cart_info = await self.cart_repo.get_cart(request.cart_id)
        if not cart_info:
            raise ValueError("Cart not found")
            
        storefront_id = cart_info["storefront_id"]
        currency = cart_info["currency"]
        
        cart_items = await self.cart_repo.get_cart_items(request.cart_id)
        
        lines = []
        subtotal_minor = 0
        
        for item in cart_items:
            variant_id = item["variant_id"]
            org_id = item["organization_id"]
            quantity = item["quantity"]
            
            # 1. Check inventory availability
            has_stock = await self.inventory_svc.check_availability(
                variant_id=variant_id, 
                organization_id=org_id, 
                quantity=quantity
            )
            if not has_stock:
                raise ValueError(f"Insufficient stock for variant {variant_id}")
                
            # 2. Fetch actual price, ignoring client total
            price_info = await self.pricing_svc.get_active_price(
                storefront_id=storefront_id,
                variant_id=variant_id
            )
            
            unit_price_minor = price_info["amount"]
            line_total = unit_price_minor * quantity
            subtotal_minor += line_total
            
            lines.append(QuoteLineItem(
                variant_id=variant_id,
                organization_id=org_id,
                quantity=quantity,
                unit_price_minor=unit_price_minor,
                tax_minor=0, # Computed later
                discount_minor=0,
                total_minor=line_total
            ))
            
        # 3. Apply promotions
        promo_info = await self.promo_svc.apply_promotions(
            storefront_id=storefront_id,
            subtotal_minor=subtotal_minor
        )
        discount_minor = promo_info["discount_minor"]
        
        # 4. Compute taxes
        tax_minor = await self.tax_svc.calculate_tax(
            subtotal_minor=subtotal_minor - discount_minor,
            storefront_id=storefront_id,
            lines=lines
        )
        
        total_minor = subtotal_minor - discount_minor + tax_minor
        
        # 5. Generate signature
        signature_payload = {
            "storefront_id": str(storefront_id),
            "subtotal_minor": subtotal_minor,
            "total_minor": total_minor,
            "lines": [{"v": str(ln.variant_id), "q": ln.quantity, "p": ln.unit_price_minor} for ln in lines]
        }
        signature = hashlib.sha256(json.dumps(signature_payload, sort_keys=True).encode()).hexdigest()
        
        quote_id = uuid.uuid4()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
        
        quote_data = {
            "id": quote_id,
            "storefront_id": storefront_id,
            "buyer_id": cart_info.get("buyer_id"),
            "anonymous_key": cart_info.get("anonymous_key"),
            "cart_id": request.cart_id,
            "status": "READY",
            "currency": currency,
            "subtotal_minor": subtotal_minor,
            "tax_minor": tax_minor,
            "shipping_minor": 0,
            "discount_minor": discount_minor,
            "total_minor": total_minor,
            "expires_at": expires_at,
            "quote_signature": signature,
            "lines": [ln.model_dump() for ln in lines],
            "promotions": []
        }
        
        await self.quote_repo.create_quote(quote_data)
        
        return CheckoutQuoteResponse(**quote_data)

    async def validate_quote(self, quote_id: uuid.UUID) -> None:
        quote = await self.quote_repo.get_quote(quote_id)
        if not quote:
            raise ValueError("Quote not found")
            
        if quote["status"] == "EXPIRED" or quote["expires_at"] < datetime.now(timezone.utc):
            raise StaleQuoteError("Quote has expired")
            
        # Check staleness of pricing
        for line in quote["lines"]:
            price_info = await self.pricing_svc.get_active_price(
                storefront_id=quote.get("storefront_id"),
                variant_id=line["variant_id"]
            )
            if price_info["amount"] != line["unit_price_minor"]:
                raise StaleQuoteError("Pricing has changed since quote generation")
