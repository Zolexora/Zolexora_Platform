from __future__ import annotations
import frappe


def forecast_sales(company: str, period: str) -> dict:
    """Placeholder for future sales forecast service."""
    frappe.logger("zolexora_predict").info(
        f"Sales forecast requested for {company} / {period}"
    )
    return {"status": "draft", "company": company, "period": period}
