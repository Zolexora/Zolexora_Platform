from __future__ import annotations
import frappe
from frappe import _


def on_document_update(doc, method) -> None:
    frappe.logger("zolexora_core").info(f"Document updated: {doc.doctype}/{doc.name}")


def health_check() -> dict:
    return {"status": "ok", "app": "zolexora_core"}


def validate_roles(roles: list[str]) -> None:
    """Helper to validate if current user has any of the required roles."""
    if not frappe.session.user or frappe.session.user == "Guest":
        frappe.throw(_("Authentication required"), frappe.PermissionError)

    user_roles = frappe.get_roles(frappe.session.user)
    if "Administrator" in user_roles or "System Manager" in user_roles:
        return

    for role in roles:
        if role in user_roles:
            return

    frappe.throw(
        _("Not permitted. Required roles: {0}").format(", ".join(roles)),
        frappe.PermissionError,
    )
