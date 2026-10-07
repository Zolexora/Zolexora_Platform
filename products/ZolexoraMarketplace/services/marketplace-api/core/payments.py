from core.config import settings
import httpx

async def create_razorpay_order(payload: dict) -> dict:
    """Create a Razorpay order using HTTP to bypass broken SDK in Python 3.12."""
    auth = (settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
    async with httpx.AsyncClient() as client:
        res = await client.post("https://api.razorpay.com/v1/orders", json=payload, auth=auth)
        res.raise_for_status()
        return res.json()

async def create_cashfree_order(payload: dict) -> dict:
    base_url = "https://sandbox.cashfree.com/pg/orders" if settings.CASHFREE_ENVIRONMENT == "SANDBOX" else "https://api.cashfree.com/pg/orders"
    headers = {
        "x-client-id": settings.CASHFREE_CLIENT_ID,
        "x-client-secret": settings.CASHFREE_CLIENT_SECRET,
        "x-api-version": "2023-08-01",
        "Content-Type": "application/json"
    }
    async with httpx.AsyncClient() as client:
        res = await client.post(base_url, json=payload, headers=headers)
        if res.status_code != 200:
            import logging
            logging.error(f"Cashfree Error: {res.text}")
            raise ValueError(f"Cashfree API rejected request: {res.text}")
        res.raise_for_status()
        return res.json()

async def get_cashfree_order(order_id: str) -> dict:
    base_url = "https://sandbox.cashfree.com/pg/orders" if settings.CASHFREE_ENVIRONMENT == "SANDBOX" else "https://api.cashfree.com/pg/orders"
    headers = {
        "x-client-id": settings.CASHFREE_CLIENT_ID,
        "x-client-secret": settings.CASHFREE_CLIENT_SECRET,
        "x-api-version": "2023-08-01",
        "Content-Type": "application/json"
    }
    async with httpx.AsyncClient() as client:
        res = await client.get(f"{base_url}/{order_id}", headers=headers)
        if res.status_code != 200:
            import logging
            logging.error(f"Cashfree Get Order Error: {res.text}")
            raise ValueError(f"Cashfree API rejected get order: {res.text}")
        res.raise_for_status()
        return res.json()
