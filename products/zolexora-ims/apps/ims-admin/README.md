# Zolexora IMS — Platform SuperAdmin Control Plane

Dedicated administrative control plane for the Zolexora Inventory Management System (IMS) platform.

- **Production Live URL**: [https://admin-ims.zolexora.workers.dev](https://admin-ims.zolexora.workers.dev)
- **Custom Domain Ready**: `admin.ims.zolexora.com`
- **Tenant Business Application**: [https://ims.zolexora.workers.dev](https://ims.zolexora.workers.dev)

---

## Architecture Overview

```
                          ┌─────────────────────────────────────────┐
                          │   Platform SuperAdmin Control Plane     │
                          │   (admin-ims.zolexora.workers.dev)      │
                          └───────────────────┬─────────────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    │                                                   │
                    ▼                                                   ▼
       ┌────────────────────────┐                          ┌────────────────────────┐
       │   Cloudflare D1 DB     │                          │  Cloudflare KV Store   │
       │  (zolexora-ims-1-db)   │                          │      (SESSION_KV)      │
       │  - organizations       │                          │  - admin_session:*     │
       │  - stores              │                          │  - session:* (tenant)  │
       │  - users               │                          └────────────────────────┘
       │  - products            │                                       ▲
       │  - platform_audit_logs │                                       │ (Impersonation)
       └────────────▲───────────┘                                       │
                    │                                                   │
                    └─────────────────────────┬─────────────────────────┘
                                              │
                          ┌───────────────────┴─────────────────────┐
                          │     Tenant Business IMS Application     │
                          │        (ims.zolexora.workers.dev)       │
                          └─────────────────────────────────────────┘
```

## Features & Capabilities

1. **Tenant Organization Lifecycle**:
   - Create, edit, suspend, unsuspend, and remove tenant organizations.
   - Monitor quota utilization (SKUs, Stores, Selling Points, Users).
   - Real-time inventory valuation and sales telemetry per tenant.

2. **Global Cross-Tenant User Management**:
   - Central directory of all users across all organizations.
   - Location isolation review (`ALL`, `STORE`, `SELLING_POINT`).
   - Role promotion (SuperAdmin, Admin, Store Incharge, Cashier).
   - Password reset and account lifecycle controls.

3. **Database Health & Interactive SQL Console**:
   - Real-time row counts across all Cloudflare D1 SQLite relational tables.
   - Edge latency benchmarking.
   - Interactive SQL query runner with tabular results and safety guards.

4. **Plan Quotas & Global Feature Tiers**:
   - Manage plan tiers: *Starter*, *Pro Business*, *Enterprise Cloud*.
   - Toggle feature flags: POS Billing, Multi-Warehouse Transfers, Barcode Scanning, AI Demand Forecasting.

5. **Security & Immutable Audit Trail**:
   - Dedicated `platform_audit_logs` table tracking every platform mutation.
   - Captures actor identity, timestamp, event type, tenant ID, and execution duration.

6. **Tenant Impersonation**:
   - SuperAdmin one-click cross-launch into any tenant IMS account using ephemeral 1-hour signed tokens.

---

## Development & Deployment

```bash
# Enter admin directory
cd admin

# Install dependencies (wrangler)
npm install

# Local development server
npm run dev

# Deploy to Cloudflare Workers
npm run deploy
```

## Environment & Bindings

Configured in `admin/wrangler.toml`:
- `DB`: D1 Database `zolexora-ims-1-db` (`63b1b80b-ee96-4948-acce-c96d6ac65f61`)
- `SESSION_KV`: Cloudflare KV namespace `96c2aa5eace04fe0aa2bbafd29de9f76`
- `SUPERADMIN_EMAIL`: Default superadmin account
- `TENANT_IMS_URL`: `https://ims.zolexora.workers.dev`
