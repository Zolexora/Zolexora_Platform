# Zolexora IMS — Monorepo

Enterprise Multi-Tenant Cloud Inventory Management System (IMS) running on Cloudflare Workers edge network with Cloudflare D1 (SQLite) and KV distributed session caching.

---

## 🏛️ Monorepo Structure

```
Zolexora_IMS/
├── apps/
│   ├── ims-admin/                # Platform SuperAdmin Control Plane
│   │   ├── frontend/             # React + Vite SuperAdmin Dashboard
│   │   ├── backend/              # FastAPI Control Plane service
│   │   ├── worker.js             # Platform Admin Worker & API router
│   │   ├── wrangler.toml         # Cloudflare Worker configuration (service: admin-ims)
│   │   └── README.md             # Admin plane documentation
│   │
│   └── ims-user/                 # Multi-Tenant Business IMS Application
│       ├── frontend/             # React + Vite POS & Inventory SPA
│       ├── backend/              # FastAPI Inventory & Multi-tenant backend
│       ├── migrations/           # Cloudflare D1 relational database schemas
│       ├── worker.js             # Multi-tenant edge worker & D1 relational engine
│       ├── wrangler.toml         # Cloudflare Worker configuration (service: ims)
│       └── README.md             # Business application documentation
│
├── package.json                  # Root Monorepo orchestrator with npm workspaces
└── README.md                     # Central Monorepo documentation
```

---

## 🚀 Live Production Applications

| Application | Directory | Service Name | Production Edge URL | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Tenant IMS Application** | `apps/ims-user` | `ims` | [https://ims.zolexora.workers.dev](https://ims.zolexora.workers.dev) | Multi-tenant inventory, stores, POS billing, purchases, expenses |
| **Platform Admin Control Plane** | `apps/ims-admin` | `admin-ims` | [https://admin-ims.zolexora.workers.dev](https://admin-ims.zolexora.workers.dev) | SuperAdmin tenant lifecycle, user directory, D1 diagnostics, SQL console |

---

## 🛠️ Monorepo Commands

From the root directory:

```bash
# Build all apps (bundles HTML/CSS/JS into edge worker artifacts)
npm run build

# Build individual apps
npm run build:user     # or npm run build:ims
npm run build:admin

# Deploy both applications to Cloudflare Workers
npm run deploy:all

# Deploy individual applications
npm run deploy:user     # or npm run deploy:ims
npm run deploy:admin

# Local edge development
npm run dev:user        # or npm run dev:ims
npm run dev:admin
```

---

## 🗄️ Database & Storage Architecture

Both applications connect to shared, high-performance Cloudflare serverless resources:

- **Cloudflare D1 Database**: `zolexora-ims-1-db` (`63b1b80b-ee96-4948-acce-c96d6ac65f61`)
  - 13 relational tables: `organizations`, `stores`, `selling_points`, `users`, `products`, `suppliers`, `supplier_transactions`, `issuance_transactions`, `selling_point_sales`, `selling_point_purchases`, `selling_point_expenses`, `settings`, `platform_audit_logs`.
- **Cloudflare KV Namespace**: `SESSION_KV` (`96c2aa5eace04fe0aa2bbafd29de9f76`)
  - Sub-millisecond distributed session tokens (`session:*` for tenants, `admin_session:*` for SuperAdmins).
