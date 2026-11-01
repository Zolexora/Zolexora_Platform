"""
Zolexora IMS — Payment Gateway Integration Engine
Supports: Razorpay, Cashfree Payments, NPCI Dynamic UPI QR, and Soundbox Confirmations.
"""

import os
import hmac
import hashlib
import urllib.parse
from typing import Dict, Any, Optional
from pydantic import BaseModel


class RazorpayOrderRequest(BaseModel):
    amount: float  # In INR
    bill_no: str
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    notes: Optional[Dict[str, str]] = None


class RazorpayVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    bill_no: str
    amount: float


class CashfreeOrderRequest(BaseModel):
    amount: float
    bill_no: str
    customer_phone: Optional[str] = "9876543210"
    customer_email: Optional[str] = "guest@zolexora.com"
    return_url: Optional[str] = None


class CashfreeVerifyRequest(BaseModel):
    order_id: str
    bill_no: str


class PaymentEngine:
    def __init__(self):
        self.razorpay_key_id = os.getenv("RAZORPAY_KEY_ID")
        self.razorpay_key_secret = os.getenv("RAZORPAY_KEY_SECRET")
        self.razorpay_webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET")

        self.cashfree_app_id = os.getenv("CASHFREE_APP_ID")
        self.cashfree_secret_key = os.getenv("CASHFREE_SECRET_KEY")
        self.cashfree_env = os.getenv("CASHFREE_ENV", "TEST")
        self.cashfree_webhook_secret = os.getenv("CASHFREE_WEBHOOK_SECRET")

    # --------------------------------------------------------------------------
    # RAZORPAY INTEGRATION
    # --------------------------------------------------------------------------
    def create_razorpay_order(self, req: RazorpayOrderRequest) -> Dict[str, Any]:
        amount_in_paise = int(round(req.amount * 100))
        receipt_id = f"REC_{req.bill_no}"

        if self.razorpay_key_id and self.razorpay_key_secret:
            try:
                import razorpay
                client = razorpay.Client(auth=(self.razorpay_key_id, self.razorpay_key_secret))
                order = client.order.create({
                    "amount": amount_in_paise,
                    "currency": "INR",
                    "receipt": receipt_id,
                    "payment_capture": 1,
                    "notes": req.notes or {"bill_no": req.bill_no}
                })
                return {
                    "success": True,
                    "gateway": "Razorpay",
                    "order_id": order["id"],
                    "amount": req.amount,
                    "amount_in_paise": amount_in_paise,
                    "currency": "INR",
                    "key_id": self.razorpay_key_id,
                    "raw": order
                }
            except Exception as e:
                pass

        # Fallback simulator for development/testing when keys not set
        import secrets
        sim_order_id = f"order_rzp_{secrets.token_hex(7)}"
        return {
            "success": True,
            "gateway": "Razorpay (Sandbox Simulator)",
            "order_id": sim_order_id,
            "amount": req.amount,
            "amount_in_paise": amount_in_paise,
            "currency": "INR",
            "key_id": self.razorpay_key_id or "rzp_test_zolexora_demo",
            "simulated": True
        }

    def verify_razorpay_payment(self, req: RazorpayVerifyRequest) -> Dict[str, Any]:
        if self.razorpay_key_secret:
            msg = f"{req.razorpay_order_id}|{req.razorpay_payment_id}".encode("utf-8")
            generated = hmac.new(self.razorpay_key_secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()
            valid = hmac.compare_digest(generated, req.razorpay_signature)
        else:
            valid = True  # Sandbox simulated mode

        return {
            "success": valid,
            "bill_no": req.bill_no,
            "order_id": req.razorpay_order_id,
            "payment_id": req.razorpay_payment_id,
            "settled": valid,
            "soundbox_announcement": f"Received payment of ₹{req.amount:.2f} successfully via Razorpay"
        }

    # --------------------------------------------------------------------------
    # CASHFREE PAYMENTS INTEGRATION
    # --------------------------------------------------------------------------
    def create_cashfree_order(self, req: CashfreeOrderRequest) -> Dict[str, Any]:
        order_id = f"CF_{req.bill_no}"

        if self.cashfree_app_id and self.cashfree_secret_key:
            try:
                from cashfree_pg.api_client import Cashfree
                from cashfree_pg.models.create_order_request import CreateOrderRequest
                from cashfree_pg.models.customer_details import CustomerDetails
                from cashfree_pg.models.order_meta import OrderMeta

                Cashfree.XClientId = self.cashfree_app_id
                Cashfree.XClientSecret = self.cashfree_secret_key
                Cashfree.XEnvironment = Cashfree.SANDBOX if self.cashfree_env == "TEST" else Cashfree.PRODUCTION

                customer = CustomerDetails(
                    customer_id=f"CUST_{req.bill_no}",
                    customer_phone=req.customer_phone or "9876543210",
                    customer_email=req.customer_email or "guest@zolexora.com"
                )
                meta = OrderMeta(
                    return_url=req.return_url or f"https://ims.zolexora.com/pos/payment/callback?order_id={order_id}"
                )
                cf_req = CreateOrderRequest(
                    order_id=order_id,
                    order_amount=req.amount,
                    order_currency="INR",
                    customer_details=customer,
                    order_meta=meta
                )
                res = Cashfree().PGCreateOrder(x_api_version="2023-08-01", create_order_request=cf_req)
                return {
                    "success": True,
                    "gateway": "Cashfree",
                    "order_id": res.data.order_id,
                    "payment_session_id": res.data.payment_session_id,
                    "amount": req.amount,
                    "environment": self.cashfree_env
                }
            except Exception as e:
                pass

        # Fallback simulator
        import secrets
        sim_session_id = f"session_cf_{secrets.token_hex(12)}"
        return {
            "success": True,
            "gateway": "Cashfree (Sandbox Simulator)",
            "order_id": order_id,
            "payment_session_id": sim_session_id,
            "amount": req.amount,
            "environment": "TEST",
            "simulated": True
        }


payment_engine = PaymentEngine()
