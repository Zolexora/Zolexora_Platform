from __future__ import annotations

from pathlib import Path

import frappe
from frappe import _


COMPANY_NAME = "Zolexora ERP"
COMPANY_ABBR = "ZEX"
DEFAULT_COUNTRY = "United States"
DEFAULT_CURRENCY = "USD"
DEFAULT_LANGUAGE = "English"
DEFAULT_TIMEZONE = "UTC"


class BootstrapError(Exception):
    """Raised when deterministic Zolexora bootstrap prerequisites are missing."""


def setup_site(
    site_name: str | None = None,
    admin_email: str | None = None,
    create_workspaces: bool = True,
) -> None:
    """Configure a Zolexora ERP site after ERPNext and custom apps are installed."""
    if site_name:
        frappe.init(site=site_name)
        frappe.connect()

    try:
        frappe.set_user("Administrator")
        _set_defaults(admin_email)
        validate_required_masters(create_missing=True)
        _create_company()
        _create_default_roles()
        if create_workspaces:
            create_custom_workspaces()
        frappe.db.commit()
    except Exception:
        frappe.db.rollback()
        raise


def validate_required_masters(create_missing: bool = False) -> dict[str, str]:
    """Validate ERPNext master data required before company creation."""
    results: dict[str, str] = {}

    _ensure_doc(
        "Currency",
        DEFAULT_CURRENCY,
        {"currency_name": "US Dollar", "enabled": 1},
        create_missing,
        results,
    )
    _ensure_doc(
        "Country",
        DEFAULT_COUNTRY,
        {"country_name": DEFAULT_COUNTRY},
        create_missing,
        results,
    )
    _ensure_doc(
        "UOM",
        "Nos",
        {"uom_name": "Nos", "enabled": 1, "must_be_whole_number": 1},
        create_missing,
        results,
    )
    _ensure_doc(
        "Warehouse Type",
        "Transit",
        {"description": "Transit warehouse type required by ERPNext company setup."},
        create_missing,
        results,
    )

    missing = [f"{doctype}: {name}" for doctype, name in results.items() if name == "missing"]
    if missing:
        raise BootstrapError(
            _("Missing ERPNext master data required for bootstrap: {0}").format(
                ", ".join(missing)
            )
        )

    frappe.db.commit()
    return results


def smoke_validate() -> dict[str, object]:
    """Run post-bootstrap checks that can be executed from bench."""
    installed_apps = set(frappe.get_installed_apps())
    required_apps = {
        "erpnext",
        "payments",
        "zolexora_core",
        "zolexora_branding",
        "zolexora_platform",
        "zolexora_integrations",
    }
    missing_apps = sorted(required_apps - installed_apps)

    workspace_names = [
        "Zolexora Dashboard",
        "Zolexora Accounts",
        "Zolexora Sales",
        "Zolexora Purchase",
        "Zolexora Inventory",
        "Zolexora Administration",
    ]
    missing_workspaces = [
        name for name in workspace_names if not frappe.db.exists("Workspace", name)
    ]

    checks = {
        "site": frappe.local.site,
        "administrator_exists": bool(frappe.db.exists("User", "Administrator")),
        "company_exists": bool(frappe.db.exists("Company", COMPANY_NAME)),
        "missing_apps": missing_apps,
        "missing_workspaces": missing_workspaces,
        "scheduler_enabled": bool(frappe.db.get_single_value("System Settings", "enable_scheduler")),
    }

    failures = []
    if not checks["administrator_exists"]:
        failures.append("Administrator user is missing")
    if not checks["company_exists"]:
        failures.append(f"Company is missing: {COMPANY_NAME}")
    if missing_apps:
        failures.append("Missing apps: " + ", ".join(missing_apps))
    if missing_workspaces:
        failures.append("Missing workspaces: " + ", ".join(missing_workspaces))

    if failures:
        raise BootstrapError("; ".join(failures))

    return checks


def verify_attachment_integrity() -> dict[str, object]:
    """Verify that File records with local URLs point to restored files."""
    missing_files: list[str] = []
    checked = 0
    site_path = Path(frappe.get_site_path())

    for file_doc in frappe.get_all(
        "File",
        filters={"is_folder": 0},
        fields=["name", "file_url"],
    ):
        file_url = file_doc.file_url
        if not file_url or "://" in file_url:
            continue

        if file_url.startswith("/private/files/"):
            file_path = site_path / "private" / "files" / Path(file_url).name
        elif file_url.startswith("/files/"):
            file_path = site_path / "public" / "files" / Path(file_url).name
        else:
            continue

        checked += 1
        if not file_path.exists():
            missing_files.append(f"{file_doc.name}: {file_url}")

    if missing_files:
        raise BootstrapError(
            _("Missing restored attachment files: {0}").format(", ".join(missing_files))
        )

    return {"checked": checked, "missing": 0}


def _set_defaults(admin_email: str | None = None) -> None:
    frappe.db.set_default("language", frappe.db.get_default("language") or DEFAULT_LANGUAGE)
    frappe.db.set_default("timezone", frappe.db.get_default("timezone") or DEFAULT_TIMEZONE)
    frappe.db.set_default("country", frappe.db.get_default("country") or DEFAULT_COUNTRY)
    frappe.db.set_default("currency", frappe.db.get_default("currency") or DEFAULT_CURRENCY)

    if admin_email:
        frappe.db.set_default("user_email", admin_email)


def _ensure_doc(
    doctype: str,
    name: str,
    fields: dict[str, object],
    create_missing: bool,
    results: dict[str, str],
) -> None:
    if frappe.db.exists(doctype, name):
        results[f"{doctype}:{name}"] = "exists"
        return

    if not create_missing:
        results[f"{doctype}:{name}"] = "missing"
        return

    doc_data = {"doctype": doctype, "name": name}
    doc_data.update(fields)
    frappe.get_doc(doc_data).insert(ignore_permissions=True)
    results[f"{doctype}:{name}"] = "created"


def _create_company() -> None:
    if frappe.db.exists("Company", COMPANY_NAME):
        return

    company = frappe.get_doc(
        {
            "doctype": "Company",
            "company_name": COMPANY_NAME,
            "default_currency": DEFAULT_CURRENCY,
            "country": DEFAULT_COUNTRY,
            "company_abbr": COMPANY_ABBR,
            "is_default": 1,
        }
    )
    company.insert(ignore_permissions=True)
    frappe.db.commit()


def _create_default_roles() -> None:
    roles = [
        "Super Admin",
        "Manager",
        "HR",
        "Accountant",
        "Inventory Manager",
        "Sales Executive",
        "Purchase Executive",
        "Viewer",
    ]
    for role_name in roles:
        if not frappe.db.exists("Role", role_name):
            frappe.get_doc({"doctype": "Role", "role_name": role_name}).insert(
                ignore_permissions=True
            )
    frappe.db.commit()


def create_custom_workspaces() -> None:
    """Create custom workspaces only when their backing modules are installed."""
    available_modules = {module.name for module in frappe.get_all("Module Def", fields=["name"])}
    workspaces = [
        {"title": "Zolexora Dashboard", "icon": "dashboard", "module": "Zolexora Core"},
        {"title": "Zolexora Accounts", "icon": "briefcase", "module": "Accounts"},
        {"title": "Zolexora Sales", "icon": "graph", "module": "Selling"},
        {"title": "Zolexora Purchase", "icon": "truck", "module": "Buying"},
        {"title": "Zolexora Inventory", "icon": "package", "module": "Stock"},
        {"title": "Zolexora CRM", "icon": "customer", "module": "CRM"},
        {"title": "Zolexora Fleet", "icon": "delivery", "module": "Zolexora Platform"},
        {"title": "Zolexora Logistics", "icon": "globe", "module": "Zolexora Platform"},
        {"title": "Zolexora Analytics", "icon": "chart-pie", "module": "Zolexora Platform"},
        {
            "title": "Zolexora Administration",
            "icon": "setting",
            "module": "Setup",
        },
        {"title": "Zolexora AI", "icon": "bolt", "module": "Zolexora Platform"},
    ]
    for ws in workspaces:
        name = ws["title"]
        if ws["module"] not in available_modules:
            continue
        if frappe.db.exists("Workspace", name):
            continue

        frappe.get_doc(
            {
                "doctype": "Workspace",
                "name": name,
                "title": name,
                "label": name,
                "icon": ws["icon"],
                "module": ws["module"],
                "is_standard": 0,
                "public": 1,
                "content": "[]",
            }
        ).insert(ignore_permissions=True)
    frappe.db.commit()
