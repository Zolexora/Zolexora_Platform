# Zolexora ERP API Guide

A reference guide for custom whitelisted REST API endpoints available in Zolexora ERP.

---

## 1. Authentication & Security

All whitelisted APIs require a logged-in session (via Cookie) or token-based authorization (using standard Frappe API keys: `Authorization: token API_KEY:API_SECRET`).

### Role-Based Access Control (RBAC)
Every endpoint checks user permissions. If the user does not possess one of the authorized roles, the API returns a `403 Forbidden` error.

---

## 2. API Endpoints

### Core APIs (`zolexora_core`)

#### Get Customers
- **Endpoint:** `/api/method/zolexora_core.api_endpoints.get_customers`
- **Method:** `GET` / `POST`
- **Required Roles:** `Sales Executive`, `Manager`
- **Returns:** List of active customer names, groups, and territories.

#### Get Suppliers
- **Endpoint:** `/api/method/zolexora_core.api_endpoints.get_suppliers`
- **Method:** `GET` / `POST`
- **Required Roles:** `Purchase Executive`, `Manager`
- **Returns:** Active suppliers list.

#### Get Inventory
- **Endpoint:** `/api/method/zolexora_core.api_endpoints.get_inventory`
- **Method:** `GET` / `POST`
- **Required Roles:** `Inventory Manager`, `Manager`
- **Returns:** Items list containing standard/valuation rates.

#### Get Sales Orders
- **Endpoint:** `/api/method/zolexora_core.api_endpoints.get_sales_orders`
- **Method:** `GET` / `POST`
- **Required Roles:** `Sales Executive`, `Accountant`, `Manager`
- **Returns:** Sales orders containing customer, grand total, and status fields.

#### Inventory Status (Bin-level check)
- **Endpoint:** `/api/method/zolexora_core.api_endpoints.inventory_status`
- **Method:** `GET` / `POST`
- **Required Roles:** `Inventory Manager`, `Manager`
- **Returns:** Actual stock counts mapped directly from system Bins (`tabBin`).

---

### Platform APIs (`zolexora_platform`)

#### Fleet Status
- **Endpoint:** `/api/method/zolexora_platform.api_endpoints.fleet_status`
- **Method:** `GET` / `POST`
- **Required Roles:** `Manager`
- **Returns:** List of active vehicles, numbers, statuses, and types.

#### AI Insights Dashboard
- **Endpoint:** `/api/method/zolexora_platform.api_endpoints.ai_dashboard`
- **Method:** `GET` / `POST`
- **Required Roles:** `Manager`
- **Returns:** AI forecasting data and insights.
