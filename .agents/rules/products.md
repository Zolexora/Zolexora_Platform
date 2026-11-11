# Zolexora Platform — Product Descriptions

Always use these canonical names, descriptions and paths. Never use the old folder names (`ZolexoraMarketplace`, `TheTextileCare`, `Zolexora_TMS`, …): every product lives at `apps/<category>/<product>/` (`core-platform/zolexora-<name>` or `standalone-apps/<name>`). The full list is in [apps/README.md](../../apps/README.md).

## Product Reference Table

| Product | Description | Path |
| --- | --- | --- |
| Zolexora Shop | Ecom marketplace app | `apps/core-platform/zolexora-shop/` |
| The Textile Care | Laundry app | `apps/standalone-apps/textile-care/` |
| Zolexora TMS | Transport management | `apps/core-platform/zolexora-tms/` |
| Zolexora IMS | Inventory management | `apps/core-platform/zolexora-ims/` |
| Zolexora ERP | ERP on Frappe/ERPNext | `apps/core-platform/zolexora-erp/` |
| Zolexora IronClub | Gym management | `apps/standalone-apps/ironclub/` |
| Rento Easy | Property rental | `apps/standalone-apps/rentoeasy/` |
| Zolexora AppSuite | Commissioned-app intake + dev console | `apps/core-platform/zolexora-appsuite/` |
| Zolexora AI | Multi-agent codebase generator | `apps/core-platform/zolexora-ai/` |
| Zolexora Engage | WhatsApp driver dispatch | `apps/core-platform/zolexora-engage/` |
| ClarityFi | Personal finance tracker | `apps/standalone-apps/clarityfi/` |
| Maun Kavach | Encrypted messenger | `apps/standalone-apps/maunkavach/` |

## Zolexora Shop — Ecom Marketplace App

**What it is:** Multi-storefront e-commerce marketplace.

- Two branded storefronts: **Zolexora Shop** (`shop.zolexora.com`) and **Mahila Madel** (`mahilamadel.store`) — `apps/storefronts/`
- Shared **seller portal** (`seller.zolexora.com`) and **marketplace admin** (`admin.marketplace.zolexora.com`) — `apps/portals/`
- Backend: FastAPI (Python 3.12) · PostgreSQL · Redis — `services/marketplace-api/`
- Frontend: Next.js (web) + Expo React Native (mobile)
- Product-local packages: `packages/shared-api`, `packages/shared-config`
- Path: `apps/core-platform/zolexora-shop/`

## The Textile Care — Laundry App

**What it is:** Multi-tenant, white-label laundry services platform.

- Customer: `apps/marketplace-web` + `apps/marketplace-mobile`
- Laundry shop owners: `apps/seller-web` + `apps/seller-mobile`
- Delivery: `apps/driver-mobile` (pickup & delivery)
- Platform admin: `apps/admin-web`
- Backend: FastAPI (Python 3.12) · PostgreSQL · Redis — `services/backend/`
- Frontend: Next.js (web) + Expo React Native (mobile)
- Key domains: orders, pickups, driver assignment, pricing, billing, settlement, memberships, multi-tenant RBAC
- Path: `apps/standalone-apps/textile-care/`
