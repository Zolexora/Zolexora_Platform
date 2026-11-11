# Zolexora Platform — Product Descriptions

Always use these canonical names, descriptions and paths. Never use the old folder names (`ZolexoraMarketplace`, `TheTextileCare`, `Zolexora_TMS`, …): every product lives at `products/zolexora-<product>/`. The full list is in [products/README.md](../../products/README.md).

## Product Reference Table

| Product | Description | Path |
| --- | --- | --- |
| Zolexora Shop | Ecom marketplace app | `products/zolexora-shop/` |
| The Textile Care | Laundry app | `products/zolexora-textile-care/` |
| Zolexora TMS | Transport management | `products/zolexora-tms/` |
| Zolexora IMS | Inventory management | `products/zolexora-ims/` |
| Zolexora ERP | ERP on Frappe/ERPNext | `products/zolexora-erp/` |
| Zolexora IronClub | Gym management | `products/zolexora-ironclub/` |
| Rento Easy | Property rental | `products/zolexora-rentoeasy/` |
| Zolexora AppSuite | Commissioned-app intake + dev console | `products/zolexora-appsuite/` |
| Zolexora AI | Multi-agent codebase generator | `products/zolexora-ai/` |
| Zolexora Engage | WhatsApp driver dispatch | `products/zolexora-engage/` |
| ClarityFi | Personal finance tracker | `products/zolexora-clarityfi/` |
| Maun Kavach | Encrypted messenger | `products/zolexora-maunkavach/` |

## Zolexora Shop — Ecom Marketplace App

**What it is:** Multi-storefront e-commerce marketplace.

- Two branded storefronts: **Zolexora Shop** (`shop.zolexora.com`) and **Mahila Madel** (`mahilamadel.store`) — `apps/storefronts/`
- Shared **seller portal** (`seller.zolexora.com`) and **marketplace admin** (`admin.marketplace.zolexora.com`) — `apps/portals/`
- Backend: FastAPI (Python 3.12) · PostgreSQL · Redis — `services/marketplace-api/`
- Frontend: Next.js (web) + Expo React Native (mobile)
- Product-local packages: `packages/shared-api`, `packages/shared-config`
- Path: `products/zolexora-shop/`

## The Textile Care — Laundry App

**What it is:** Multi-tenant, white-label laundry services platform.

- Customer: `apps/marketplace-web` + `apps/marketplace-mobile`
- Laundry shop owners: `apps/seller-web` + `apps/seller-mobile`
- Delivery: `apps/driver-mobile` (pickup & delivery)
- Platform admin: `apps/admin-web`
- Backend: FastAPI (Python 3.12) · PostgreSQL · Redis — `services/backend/`
- Frontend: Next.js (web) + Expo React Native (mobile)
- Key domains: orders, pickups, driver assignment, pricing, billing, settlement, memberships, multi-tenant RBAC
- Path: `products/zolexora-textile-care/`
