from __future__ import annotations
import frappe


def apply_branding(bootinfo) -> None:
    """Apply Zolexora branding metadata to the Frappe boot info."""
    bootinfo["zolexora_branding"] = {
        "brand": "Zolexora ERP",
        "short_name": "Zolexora",
        "logo": "/assets/zolexora_branding/img/zolexora-logo.svg",
        "icon": "/assets/zolexora_branding/img/zolexora-icon.svg",
        "favicon": "/assets/zolexora_branding/img/favicon.svg",
    }
    frappe.logger("zolexora_branding").debug("Applied Zolexora branding to boot info")
