from __future__ import annotations
import frappe


def log_event(event_type: str, message: str, metadata: dict | None = None) -> None:
    frappe.logger("zolexora_events").info(
        {
            "event_type": event_type,
            "message": message,
            "metadata": metadata or {},
        }
    )
