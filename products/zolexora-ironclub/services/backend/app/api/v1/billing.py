import uuid
from datetime import datetime, timezone
from fastapi import APIRouter
from app.services.mock_data import MOCK_INVOICES

router = APIRouter(prefix="/billing", tags=["Billing & Subscriptions"])

MEMBERSHIP_PLANS = [
    {
        "id": "plan-bronze",
        "name": "Bronze Off-Peak",
        "tier": "BRONZE",
        "priceMonthly": 1999,
        "priceAnnual": 19990,
        "accessHours": "11:00 AM - 04:00 PM Weekdays Only",
        "perks": ["Access to Cardio & Weight Floor during off-peak", "Locker Room & Showers"]
    },
    {
        "id": "plan-silver",
        "name": "Silver All-Hours",
        "tier": "SILVER",
        "priceMonthly": 2999,
        "priceAnnual": 29990,
        "accessHours": "Full 05:00 AM - 11:30 PM Access",
        "perks": ["Unlimited Gym Access", "Full Locker Room & Steam Access", "1 Free Trainer Assessment"]
    },
    {
        "id": "plan-gold",
        "name": "Gold Executive Club",
        "tier": "GOLD",
        "priceMonthly": 4499,
        "priceAnnual": 44990,
        "accessHours": "Full Access + All Group Classes",
        "perks": ["Unlimited Gym Access", "Unlimited HIIT / Powerlifting / CrossFit / Yoga Classes", "Sauna & Ice Bath", "Guest Pass 1x/month"]
    },
    {
        "id": "plan-black-iron",
        "name": "Black Iron VIP Elite",
        "tier": "BLACK_IRON_VIP",
        "priceMonthly": 7499,
        "priceAnnual": 74990,
        "accessHours": "24/7 Multi-Branch All Access",
        "perks": ["Access to all IronClub branches nationwide", "Dedicated Personal Locker", "2 PT Sessions/month included", "Pro-Shop 15% VIP discount", "Priority Turnstile Entry"]
    }
]

@router.get("/plans")
def list_plans():
    return {
        "plans": MEMBERSHIP_PLANS
    }

@router.get("/invoices")
def list_invoices():
    return {
        "count": len(MOCK_INVOICES),
        "invoices": MOCK_INVOICES
    }

@router.post("/checkout/initiate")
def initiate_payment(planId: str, gateway: str = "RAZORPAY"):
    plan = next((p for p in MEMBERSHIP_PLANS if p["id"] == planId), MEMBERSHIP_PLANS[2])
    order_id = f"order_ic_{uuid.uuid4().hex[:10]}"
    amount = plan["priceAnnual"]
    tax = round(amount * 0.18, 2) # 18% GST
    total = amount + tax
    
    return {
        "orderId": order_id,
        "gateway": gateway, # RAZORPAY / CASHFREE / UPI_QR
        "amount": amount,
        "tax": tax,
        "totalAmount": total,
        "currency": "INR",
        "planName": plan["name"],
        "upiQrString": f"upi://pay?pa=ironclub@icici&pn=ZolexoraIronClub&am={total}&cu=INR&tn=Membership-{plan['name']}",
        "gatewayCheckoutData": {
            "key": "rzp_test_ironclubdemo",
            "order_id": order_id,
            "name": "Zolexora IronClub Gym",
            "theme": { "color": "#EAB308" }
        }
    }
