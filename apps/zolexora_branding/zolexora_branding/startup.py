from __future__ import annotations
import frappe


def apply_branding(bootinfo) -> None:
    """Apply Zolexora branding metadata to the Frappe boot info."""
    bootinfo["zolexora_branding"] = {
        "brand": "Zolexora ERP",
        "logo": "/assets/zolexora_branding/images/logo.svg",
    }
    frappe.logger("zolexora_branding").debug("Applied Zolexora branding to boot info")
