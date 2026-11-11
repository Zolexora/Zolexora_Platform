"""Payment gateways for one business (Razorpay, Cashfree), over their REST APIs with the access token of
the business's own connected account (gateways.py). No simulators and no shared SDK state: no connection
or a gateway error is an error, and a bill is paid only when the gateway says so (signature or order
status) for the amount we recorded."""
import base64
import hashlib
import hmac
from typing import Any, Dict, Optional

import httpx
from pydantic import BaseModel

RAZORPAY_API = "https://api.razorpay.com/v1"
CASHFREE_API = {"TEST": "https://sandbox.cashfree.com/pg", "PRODUCTION": "https://api.cashfree.com/pg"}  # VERIFY for partner tokens
CASHFREE_API_VERSION = "2023-08-01"


class RazorpayOrderRequest(BaseModel):
    amount: float  # INR
    bill_no: str
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None


class RazorpayVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    bill_no: Optional[str] = None


class CashfreeOrderRequest(BaseModel):
    amount: float
    bill_no: str
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    return_url: Optional[str] = None


class CashfreeVerifyRequest(BaseModel):
    order_id: str
    bill_no: Optional[str] = None


class PaymentError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def _hmac_hex(secret: str, data: bytes) -> str:
    return hmac.new(secret.encode(), data, hashlib.sha256).hexdigest()


def razorpay_signature_ok(secret: str, order_id: str, payment_id: str, signature: str) -> bool:
    return hmac.compare_digest(_hmac_hex(secret, f"{order_id}|{payment_id}".encode()), signature or "")


def razorpay_webhook_ok(secret: str, body: bytes, signature: str) -> bool:
    return bool(secret) and hmac.compare_digest(_hmac_hex(secret, body), signature or "")


def cashfree_webhook_ok(secret: str, timestamp: str, body: bytes, signature: str) -> bool:
    if not (secret and timestamp):
        return False
    expected = base64.b64encode(hmac.new(secret.encode(), timestamp.encode() + body, hashlib.sha256).digest()).decode()
    return hmac.compare_digest(expected, signature or "")


def to_paise(amount: float) -> int:
    return int(round(amount * 100))


class PaymentEngine:
    def __init__(self, cfg: Optional[Dict[str, Any]] = None):
        cfg = cfg or {}
        self.razorpay_access_token = cfg.get("razorpay_access_token")
        self.razorpay_public_token = cfg.get("razorpay_public_token")
        self.razorpay_signing_secret = cfg.get("razorpay_signing_secret")
        self.cashfree_access_token = cfg.get("cashfree_access_token")
        self.cashfree_env = "PRODUCTION" if str(cfg.get("cashfree_env") or "").upper() == "PRODUCTION" else "TEST"

    async def _call(self, method: str, url: str, **kw) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.request(method, url, **kw)
        except httpx.HTTPError as e:
            raise PaymentError(502, "Payment gateway unreachable") from e
        data = res.json() if res.content else {}
        if res.status_code >= 400:
            msg = (data.get("error") or {}).get("description") if isinstance(data.get("error"), dict) else data.get("message")
            raise PaymentError(502, f"Payment gateway refused the request: {msg or res.status_code}")
        return data

    # --- Razorpay ---
    def _need_razorpay(self) -> None:
        if not (self.razorpay_access_token and self.razorpay_public_token and self.razorpay_signing_secret):
            raise PaymentError(400, "Razorpay is not connected for this business yet.")

    async def create_razorpay_order(self, req: RazorpayOrderRequest) -> Dict[str, Any]:
        self._need_razorpay()
        order = await self._call(
            "POST", f"{RAZORPAY_API}/orders", headers={"Authorization": f"Bearer {self.razorpay_access_token}"},
            json={"amount": to_paise(req.amount), "currency": "INR", "receipt": req.bill_no[:40], "notes": {"bill_no": req.bill_no}},
        )
        # Checkout opens with the connection's public token in place of a key id.
        return {"order_id": order["id"], "key_id": self.razorpay_public_token, "amount_in_paise": order["amount"]}

    def razorpay_signature_ok(self, req: RazorpayVerifyRequest) -> bool:
        self._need_razorpay()
        return razorpay_signature_ok(self.razorpay_signing_secret, req.razorpay_order_id, req.razorpay_payment_id, req.razorpay_signature)

    # --- Cashfree ---
    def _cashfree_headers(self) -> Dict[str, str]:
        if not self.cashfree_access_token:
            raise PaymentError(400, "Cashfree is not connected for this business yet.")
        return {"Authorization": f"Bearer {self.cashfree_access_token}", "x-api-version": CASHFREE_API_VERSION}

    async def create_cashfree_order(self, order_id: str, req: CashfreeOrderRequest) -> Dict[str, Any]:
        headers = self._cashfree_headers()
        phone = "".join(ch for ch in (req.customer_phone or "") if ch.isdigit())[-10:]
        if len(phone) != 10:
            raise PaymentError(400, "Cashfree needs the customer's 10-digit mobile number.")
        body: Dict[str, Any] = {
            "order_id": order_id,
            "order_amount": round(req.amount, 2),
            "order_currency": "INR",
            "customer_details": {"customer_id": f"C{phone}", "customer_phone": phone, **({"customer_email": req.customer_email} if req.customer_email else {})},
            "order_note": f"Bill {req.bill_no}"[:200],
        }
        if req.return_url:
            body["order_meta"] = {"return_url": req.return_url}
        res = await self._call("POST", f"{CASHFREE_API[self.cashfree_env]}/orders", headers=headers, json=body)
        return {"order_id": res["order_id"], "payment_session_id": res["payment_session_id"], "environment": self.cashfree_env}

    async def get_cashfree_order(self, order_id: str) -> Dict[str, Any]:
        return await self._call("GET", f"{CASHFREE_API[self.cashfree_env]}/orders/{order_id}", headers=self._cashfree_headers())
