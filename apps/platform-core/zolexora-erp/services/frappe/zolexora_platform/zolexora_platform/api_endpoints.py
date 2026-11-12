from __future__ import annotations
import frappe
from frappe import _
from zolexora_core.api import validate_roles


@frappe.whitelist()
def get_reports() -> dict:
    validate_roles(["Sales Executive", "Purchase Executive", "Accountant", "Manager"])
    return {
        "reports": [
            {
                "name": "Sales Overview",
                "endpoint": "/api/method/zolexora_core.api_endpoints.sales_overview",
            },
            {
                "name": "Inventory Status",
                "endpoint": "/api/method/zolexora_core.api_endpoints.inventory_status",
            },
            {
                "name": "Fleet Status",
                "endpoint": "/api/method/zolexora_platform.api_endpoints.fleet_status",
            },
            {
                "name": "AI Dashboard",
                "endpoint": "/api/method/zolexora_platform.api_endpoints.ai_dashboard",
            },
        ]
    }


@frappe.whitelist()
def fleet_status() -> dict:
    validate_roles(["Manager"])
    vehicles = frappe.get_all(
        "Vehicle",
        fields=["name", "vehicle_number", "status", "vehicle_type"],
        limit_page_length=100,
    )
    return {"status": "ok", "vehicles": vehicles}


@frappe.whitelist()
def ai_dashboard() -> dict:
    validate_roles(["Manager"])
    return {"status": "ok", "message": _("AI insights placeholder"), "insights": []}
