from __future__ import annotations
import frappe
from zolexora_core.api import validate_roles


@frappe.whitelist()
def get_customers() -> dict:
    validate_roles(["Sales Executive", "Manager"])
    customers = frappe.get_all(
        "Customer",
        filters={"disabled": 0},
        fields=["name", "customer_name", "customer_group", "territory"],
        limit_page_length=100,
    )
    return {"customers": customers}


@frappe.whitelist()
def get_suppliers() -> dict:
    validate_roles(["Purchase Executive", "Manager"])
    suppliers = frappe.get_all(
        "Supplier",
        filters={"disabled": 0},
        fields=["name", "supplier_name", "supplier_type"],
        limit_page_length=100,
    )
    return {"suppliers": suppliers}


@frappe.whitelist()
def get_inventory() -> dict:
    validate_roles(["Inventory Manager", "Manager"])
    items = frappe.get_all(
        "Item",
        filters={"disabled": 0},
        fields=["name", "item_name", "stock_uom", "valuation_rate", "standard_rate"],
        limit_page_length=100,
    )
    return {"items": items}


@frappe.whitelist()
def get_sales_orders() -> dict:
    validate_roles(["Sales Executive", "Accountant", "Manager"])
    orders = frappe.get_all(
        "Sales Order",
        fields=["name", "customer", "transaction_date", "status", "grand_total"],
        limit_page_length=100,
    )
    return {"sales_orders": orders}


@frappe.whitelist()
def get_purchase_orders() -> dict:
    validate_roles(["Purchase Executive", "Accountant", "Manager"])
    orders = frappe.get_all(
        "Purchase Order",
        fields=["name", "supplier", "transaction_date", "status", "grand_total"],
        limit_page_length=100,
    )
    return {"purchase_orders": orders}


@frappe.whitelist()
def sales_overview() -> dict:
    validate_roles(["Sales Executive", "Accountant", "Manager"])
    sales = frappe.get_all(
        "Sales Order",
        fields=["name", "customer", "transaction_date", "grand_total", "status"],
        limit_page_length=100,
    )
    return {"status": "ok", "sales": sales}


@frappe.whitelist()
def inventory_status() -> dict:
    validate_roles(["Inventory Manager", "Manager"])
    # Resolve the DB error by querying the Bin table instead of non-existent Item.actual_stock
    bins = frappe.get_all(
        "Bin",
        fields=["item_code", "actual_qty", "warehouse"],
        limit_page_length=100,
    )
    return {"status": "ok", "items": bins}
