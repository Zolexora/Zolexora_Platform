# Zolexora Platform — Product Descriptions

Always use these canonical descriptions when referring to products in this workspace.
Never use old descriptions like "Marketplace" or "Textile industry product".

## Product Reference Table

| Product                | Description               |
|------------------------|---------------------------|
| ZolexoraMarketplace    | Ecom marketplace app      |
| TheTextileCare         | Laundry app               |

## ZolexoraMarketplace — Ecom Marketplace App

**What it is:** Multi-storefront e-commerce marketplace.

- Two branded storefronts: **Zolexora Shop** (`shop.zolexora.com`) and **Mahila Madel** (`mahilamadel.store`)
- Shared **seller portal** (`seller.zolexora.com`) and **marketplace admin** (`admin.marketplace.zolexora.com`)
- Backend: FastAPI (Python 3.12) · PostgreSQL · Redis
- Frontend: Next.js (web) + Expo React Native (mobile)
- Shared packages: `shared-api`, `shared-config`
- Path: `products/ZolexoraMarketplace/`

## TheTextileCare — Laundry App

**What it is:** Multi-tenant, white-label laundry services platform.

- Customer: **marketplace-web** + **marketplace-mobile**
- Laundry shop owners: **seller-web** + **seller-mobile**
- Delivery: **driver-mobile** (pickup & delivery)
- Platform admin: **admin-web**
- Backend: FastAPI (Python 3.12) · PostgreSQL · Redis
- Frontend: Next.js (web) + Expo React Native (mobile) — Turborepo/pnpm monorepo
- Key domains: orders, pickups, driver assignment, pricing, billing, settlement, memberships, multi-tenant RBAC
- Path: `products/TheTextileCare/`
