---
name: razorpay
description: Integrates Razorpay payment gateway, Orders API, Webhook verification, Dynamic UPI QR, and Checkout JS for Zolexora IMS.
---

# Razorpay Payment Integration Skill

This skill provides comprehensive instructions, API schemas, and best practices for implementing **Razorpay** in Zolexora IMS (FastAPI backend + Vite React POS frontend).

---

## 1. Credentials & Configuration

Razorpay requires two keys per environment:
- **Key ID**: `rzp_test_...` (Sandbox) or `rzp_live_...` (Production) - Public, safe for frontend
- **Key Secret**: `...` - Private, keep strictly in backend `.env.local`

Store in `.env.local`:
```bash
RAZORPAY_KEY_ID="rzp_test_your_key_id"
RAZORPAY_KEY_SECRET="your_key_secret"
RAZORPAY_WEBHOOK_SECRET="your_webhook_signing_secret"
```

---

## 2. Backend Order Creation (FastAPI)

Razorpay amounts must always be converted to **paise** (integers: `₹100` = `10000` paise).

```python
import razorpay

client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

def create_razorpay_order(amount_in_rupees: float, receipt_id: str, notes: dict = None):
    amount_in_paise = int(round(amount_in_rupees * 100))
    data = {
        "amount": amount_in_paise,
        "currency": "INR",
        "receipt": receipt_id,
        "payment_capture": 1, # Auto-capture payment
        "notes": notes or {}
    }
    order = client.order.create(data=data)
    return order
```

---

## 3. Cryptographic Signature Verification

Always verify the signature on backend before fulfilling the order or issuing items:

```python
import hmac
import hashlib

def verify_razorpay_payment_signature(razorpay_order_id: str, razorpay_payment_id: str, razorpay_signature: str, key_secret: str) -> bool:
    message = f"{razorpay_order_id}|{razorpay_payment_id}".encode('utf-8')
    generated_signature = hmac.new(
        key_secret.encode('utf-8'),
        message,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(generated_signature, razorpay_signature)
```

---

## 4. Frontend Checkout Integration (React / Vite)

Include the script `https://checkout.razorpay.com/v1/checkout.js`:

```typescript
export function openRazorpayCheckout(order: { id: string; amount: number; key: string; name: string; description: string; phone?: string; email?: string }, onSettled: (res: any) => void) {
  const options = {
    key: order.key,
    amount: order.amount,
    currency: "INR",
    name: order.name,
    description: order.description,
    order_id: order.id,
    handler: function (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) {
      onSettled(response);
    },
    prefill: {
      contact: order.phone || "",
      email: order.email || "",
    },
    theme: {
      color: "#059669",
    },
  };
  const rzp = new (window as any).Razorpay(options);
  rzp.open();
}
```

---

## 5. Webhook Ingestion (`POST /api/v1/payment/razorpay/webhook`)

Webhook events to handle:
- `order.paid`: When customer completes payment
- `payment.captured`: Instant settlement confirmation
- `payment.failed`: Card declined or UPI timeout

Signature header: `X-Razorpay-Signature` checked against `RAZORPAY_WEBHOOK_SECRET`.
