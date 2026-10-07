from __future__ import annotations
import frappe


def send_email_notification(recipient: str, subject: str, message: str) -> dict:
    frappe.logger("zolexora_notifications").info(f"Email placeholder for {recipient}")
    return {"status": "placeholder", "channel": "email"}


def send_sms_notification(recipient: str, message: str) -> dict:
    frappe.logger("zolexora_notifications").info(f"SMS placeholder for {recipient}")
    return {"status": "placeholder", "channel": "sms"}
