# Platform Core Non-Goals

**Status**: Defined
**Date**: October 2026

## Objective
This document outlines capabilities and data that **MUST REMAIN** inside the ERP or specific product boundaries. Platform Core is strictly for SaaS/tenant management and cross-product facilitation. It is not a monolithic repository for all business logic.

## 1. ERP-Specific Capabilities
The following domains were discovered inside `products/ZolexoraERP/backend/` and heavily rely on ERP workflows, Frappe DocTypes, and business accounting rules. They **must not** be extracted into Platform Core:

- **Accounting & General Ledger**: Management of Chart of Accounts, Journal Entries, and fiscal years.
- **Invoicing (B2B/B2C)**: Generation of sales invoices, purchase invoices, and taxes. *(Note: Platform Billing is for Zolexora's subscription billing, NOT the tenant's customer billing).*
- **Inventory & Stock Management**: Warehouses, stock reconciliation, and item valuation.
- **Logistics & Fleet**: Truck routing, maintenance logs, and shipment tracking (currently stubbed in `zolexora_platform/services/fleet.py` and `logistics.py`).
- **Selling & CRM**: Lead management, quotations, and sales orders.
- **Manufacturing**: Bills of Material (BOM), work orders.

## 2. ERP-Specific Data
Platform Core databases must NOT store:
- Sales Orders
- Customers / Suppliers
- Items / Products (unless it is a Zolexora SaaS product)
- Invoices
- Employee payroll data

## 3. Product-Specific Authorizations
Platform Core manages **coarse-grained entitlements** (e.g., "Tenant A has access to Zolexora ERP").
Platform Core does NOT manage **fine-grained business permissions** (e.g., "User X can approve Purchase Orders over $5000").
- Fine-grained business logic remains inside the specific Product (e.g., Frappe's Role Profile/Permission Manager).

## 4. Product Integrations
If an integration strictly serves one product (e.g., a specific banking integration for ERP ledger reconciliation), it belongs in the Product (e.g., `products/ZolexoraERP/backend/zolexora_integrations/`).
Platform Core `platform/integrations/` is reserved for integrations utilized across the ecosystem (e.g., SendGrid for emails, Stripe for Zolexora platform subscriptions).
