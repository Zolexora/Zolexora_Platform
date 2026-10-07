from __future__ import annotations
import frappe


def vehicle_dashboard() -> dict:
    frappe.logger("zolexora_fleet").debug("Fleet dashboard placeholder")
    return {"status": "planned", "feature": "vehicle_dashboard"}


def maintenance_tracker() -> dict:
    frappe.logger("zolexora_fleet").debug("Maintenance tracker placeholder")
    return {"status": "planned", "feature": "maintenance_tracker"}
