---
name: payment-gateways
description: Unified payment orchestration guide covering Razorpay, Cashfree, Pine Labs EDC, NPCI Dynamic UPI QR, Soundbox, and Settlement for Zolexora IMS.
---

# Unified Retail & POS Payment Orchestration Skill

This skill documents the multi-rail payment system in Zolexora IMS.

---

## 1. Supported Payment Rails

| Payment Rail | Provider / Tech | Hardware / Flow | Settlement |
| :--- | :--- | :--- | :--- |
| **Dynamic Counter UPI QR** | NPCI UPI Protocol | Counter Display / Customer Mobile | Instant to Bank VPA |
| **Razorpay Gateway** | Razorpay PG & QR | Checkout modal, Cards, UPI, Netbanking | T+1 / Instant |
| **Cashfree Payments** | Cashfree PG Drop | In-page modal, Credit/Debit, EMI | T+1 / Instant |
| **EDC Card Machine** | Pine Labs / Paytm POS | POS API Push to Card Terminal | End of Day Batch |
| **Voice Soundbox** | Web Speech / Soundbox API | Instant audio chime on counter | N/A (Audio layer) |

---

## 2. Dynamic NPCI UPI QR Specification

Every bill generates an NPCI standard URI:
```text
upi://pay?pa={vpa_handle}&pn={merchant_name}&mc={mcc_code}&am={amount_2_dec}&cu=INR&tn=Invoice_{bill_no}
```
* **`pa`**: Merchant VPA (`store@icici`)
* **`pn`**: Legal Business Name (`Zolexora Retail`)
* **`mc`**: Merchant Category Code (`5812` for restaurants)
* **`am`**: Exact bill amount in INR
* **`tn`**: Transaction Note / Invoice number

---

## 3. Webhook Architecture

All payment gateway callbacks must be idempotent and verify cryptographic signatures before marking an order as `PAID`.
- Razorpay Webhooks: `POST /api/v1/payment/razorpay/webhook`
- Cashfree Webhooks: `POST /api/v1/payment/cashfree/webhook`
- Aggregator Privileges: `POST /api/v1/aggregator/dining-benefit/verify`
