"""IMS permissions (ADR 0005 §2). Registered with the auth service on startup; owners hold all of
them, other roles get what the business owner picks in the auth service's role editor."""
import logging
import os

import httpx

try:
    from .auth import PRODUCT, auth_service_url
except ImportError:
    from auth import PRODUCT, auth_service_url

log = logging.getLogger("ims.catalog")

PERMISSIONS = {
    "ims:dashboard:view": "See the inventory dashboard",
    "ims:items:view": "See products, stock and stock movements",
    "ims:items:manage": "Add, edit and delete products",
    "ims:stock:adjust": "Adjust stock levels",
    "ims:purchases:create": "Record purchases from suppliers",
    "ims:issuance:create": "Issue stock to sites and selling points",
    "ims:requisitions:manage": "Raise and handle requisitions",
    "ims:suppliers:view": "See suppliers",
    "ims:suppliers:manage": "Add and edit suppliers",
    "ims:reports:view": "See sales and stock reports",
    "ims:sites:manage": "Manage stores and selling points",
    "ims:pos:sell": "Bill customers at the POS",
    "ims:pos:manage": "Manage POS menu, tables, terminal and online channels",
    "ims:orders:view": "See POS and online orders",
    "ims:orders:manage": "Accept, reject and update online orders",
    "ims:customers:manage": "See and edit customers",
    "ims:cash:manage": "Run the cash drawer and close shifts",
    "ims:payments:manage": "Set up UPI and payment gateways",
    "ims:company:manage": "Edit the IMS company profile",
}


async def register_catalog() -> None:
    """PUT the full list with IMS's product key. Never blocks startup: a failure is logged and the
    previously registered list stays in force."""
    base, key = auth_service_url(), (os.getenv("IMS_PRODUCT_KEY") or "").strip()
    if not base or not key:
        log.warning("Permission catalog not registered: AUTH_SERVICE_URL or IMS_PRODUCT_KEY missing (Infisical)")
        return
    body = {"permissions": [{"key": k, "description": d} for k, d in PERMISSIONS.items()]}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.put(f"{base}/api/v1/catalog/{PRODUCT}", json=body, headers={"X-Product-Key": key})
        if res.status_code >= 300:
            log.warning("Permission catalog not registered: auth service returned %s", res.status_code)
        else:
            data = res.json()
            log.info("Permission catalog v%s %s (added %s, pending removal %s)",
                     data.get("version"), data.get("status"), data.get("added"), data.get("pending_removal"))
    except httpx.HTTPError as e:
        log.warning("Permission catalog not registered: %s", e)
