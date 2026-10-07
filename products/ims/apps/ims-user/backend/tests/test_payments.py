import os
import sys
import pytest
from starlette.testclient import TestClient

# Add app backend and shared paths
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../backend-shared")))

from main import app


def test_payment_handle_get_and_update():
    with TestClient(app) as client:
        # GET default handle
        resp = client.get("/api/v1/payment/handle")
        assert resp.status_code == 200
        data = resp.json()
        assert "upi_handle" in data
        assert "merchant_name" in data

        # UPDATE handle with valid UPI VPA
        update_resp = client.post("/api/v1/payment/handle", json={
            "upi_handle": "myretailstore@icici",
            "merchant_name": "My Retail Store Pvt Ltd",
            "merchant_category_code": "5411",
            "payment_gateway": "razorpay",
            "soundbox_enabled": True,
            "auto_settle": True
        })
        assert update_resp.status_code == 200
        res_data = update_resp.json()
        assert res_data["success"] is True
        assert res_data["config"]["upi_handle"] == "myretailstore@icici"

        # UPDATE handle with invalid UPI VPA (fails validation)
        invalid_resp = client.post("/api/v1/payment/handle", json={
            "upi_handle": "invalidhandlewithoutbank",
            "merchant_name": "My Retail Store"
        })
        assert invalid_resp.status_code == 400


def test_generate_dynamic_upi_qr():
    with TestClient(app) as client:
        resp = client.post("/api/v1/payment/generate-dynamic-qr", json={
            "bill_no": "BILL-TEST-8899",
            "amount": 749.50,
            "notes": "Table 4 POS bill"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["bill_no"] == "BILL-TEST-8899"
        assert data["amount"] == 749.50
        assert data["currency"] == "INR"
        assert "upi://" in data["upi_intent_url"]
        assert "pa=" in data["upi_intent_url"]
        assert "am=749.50" in data["upi_intent_url"]
        assert "qr_code_url" in data
        assert "app_intents" in data
        assert "google_pay" in data["app_intents"]
        assert "phonepe" in data["app_intents"]
        assert "paytm" in data["app_intents"]


def test_verify_payment_settlement():
    with TestClient(app) as client:
        resp = client.post("/api/v1/payment/verify", json={
            "bill_no": "BILL-TEST-8899",
            "amount": 749.50,
            "payment_mode": "UPI",
            "transaction_ref": "UTR49281920"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["settled"] is True
        assert data["transaction_ref"] == "UTR49281920"
        assert "749.50" in data["soundbox_announcement"]


def test_razorpay_order_creation_and_verification():
    with TestClient(app) as client:
        # Create order
        resp = client.post("/api/v1/payment/razorpay/create-order", json={
            "amount": 1250.00,
            "bill_no": "BILL-RZP-101",
            "customer_phone": "9876543210",
            "customer_email": "customer@zolexora.com"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "order_id" in data
        assert data["amount"] == 1250.00
        assert data["amount_in_paise"] == 125000

        # Verify payment
        verify_resp = client.post("/api/v1/payment/razorpay/verify-payment", json={
            "razorpay_order_id": data["order_id"],
            "razorpay_payment_id": "pay_test_987654321",
            "razorpay_signature": "mock_signature_for_test",
            "bill_no": "BILL-RZP-101",
            "amount": 1250.00
        })
        assert verify_resp.status_code == 200
        vdata = verify_resp.json()
        assert vdata["settled"] is True

        # Webhook
        wh_resp = client.post("/api/v1/payment/razorpay/webhook", json={
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_test_987654321",
                        "amount": 125000
                    }
                }
            }
        })
        assert wh_resp.status_code == 200
        assert wh_resp.json()["captured"] is True


def test_cashfree_order_creation_and_verification():
    with TestClient(app) as client:
        # Create order
        resp = client.post("/api/v1/payment/cashfree/create-order", json={
            "amount": 540.00,
            "bill_no": "BILL-CF-202",
            "customer_phone": "9812345678",
            "customer_email": "cf_guest@example.com"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "order_id" in data
        assert "payment_session_id" in data
        assert data["amount"] == 540.00

        # Verify payment
        verify_resp = client.post("/api/v1/payment/cashfree/verify-payment", json={
            "order_id": data["order_id"],
            "bill_no": "BILL-CF-202"
        })
        assert verify_resp.status_code == 200
        assert verify_resp.json()["settled"] is True

        # Webhook
        wh_resp = client.post("/api/v1/payment/cashfree/webhook", json={
            "data": {
                "order": {
                    "order_id": data["order_id"]
                }
            }
        })
        assert wh_resp.status_code == 200
        assert wh_resp.json()["order_status"] == "PAID"
