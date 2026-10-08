---
name: cashfree
description: Integrates Cashfree Payment Gateway, Orders API, Seamless Drop Checkout, and Webhook verification for Zolexora IMS.
---

# Cashfree Payments Integration Skill

This skill provides comprehensive instructions, API schemas, and best practices for integrating **Cashfree Payments** in Zolexora IMS.

---

## 1. Credentials & Environments

Cashfree requires:
- **Client ID / App ID**: e.g. `TEST100...` (Sandbox) or `CF...` (Production)
- **Client Secret**: Private secret key
- **Environment**: `TEST` (sandbox.cashfree.com) or `PRODUCTION` (api.cashfree.com)
- **API Version**: `2023-08-01`

Store in `.env.local`:
```bash
CASHFREE_APP_ID="your_app_id"
CASHFREE_SECRET_KEY="your_secret_key"
CASHFREE_ENV="TEST" # or PRODUCTION
CASHFREE_WEBHOOK_SECRET="your_webhook_signing_key"
```

---

## 2. Backend Order Creation (Python SDK `cashfree-pg`)

```python
from cashfree_pg.models.create_order_request import CreateOrderRequest
from cashfree_pg.models.order_meta import OrderMeta
from cashfree_pg.models.customer_details import CustomerDetails
from cashfree_pg.api_client import Cashfree

Cashfree.XClientId = CASHFREE_APP_ID
Cashfree.XClientSecret = CASHFREE_SECRET_KEY
Cashfree.XEnvironment = Cashfree.SANDBOX if CASHFREE_ENV == "TEST" else Cashfree.PRODUCTION

def create_cashfree_order(bill_no: str, amount: float, customer_phone: str = "9876543210", return_url: str = None):
    customer = CustomerDetails(
        customer_id=f"CUST_{bill_no}",
        customer_phone=customer_phone,
        customer_name="Retail Customer"
    )
    meta = OrderMeta(
        return_url=return_url or "https://ims.zolexora.com/pos/payment/callback?order_id={order_id}"
    )
    request = CreateOrderRequest(
        order_id=f"CF_{bill_no}",
        order_amount=amount,
        order_currency="INR",
        customer_details=customer,
        order_meta=meta
    )
    res = Cashfree().PGCreateOrder(x_api_version="2023-08-01", create_order_request=request)
    return res.data # Contains payment_session_id
```

---

## 3. Frontend Seamless Drop Checkout (React / Vite)

Include the Cashfree JS SDK: `https://sdk.cashfree.com/js/v3/cashfree.js`:

```typescript
export async function openCashfreeDrop(paymentSessionId: string, isProduction: boolean = false) {
  const cashfree = (window as any).Cashfree({
    mode: isProduction ? "production" : "sandbox",
  });
  
  await cashfree.checkout({
    paymentSessionId: paymentSessionId,
    redirectTarget: "_modal", // Opens inside an in-page modal
  });
}
```

---

## 4. Webhook Verification

Cashfree sends signature in the headers:
- Header: `x-webhook-signature`
- Timestamp: `x-webhook-timestamp`
Verify payload HMAC SHA256 against `CASHFREE_WEBHOOK_SECRET`.
