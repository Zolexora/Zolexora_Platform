# Architecture

## Monorepo

One pnpm workspace (root `pnpm-workspace.yaml`) orchestrated by Turborepo. Products link shared code with `workspace:*`; there are no nested lockfiles or workspaces.

| Path | Holds |
| --- | --- |
| `products/<name>/` | One deployable product each: its apps, services, product-local packages, `compose.yaml`, Dockerfiles, scripts, docs. |
| `apps/` | Cross-product apps: `zolexora-auth-service` (central identity, Node, port 3081) and `zolexora-platform-admin` (FastAPI `backend/` + `frontend/`). |
| `platform/` | Cross-product runtime modules: `api-shield` (Cloudflare Worker), `auth/user-auth-core`, `auth/user-auth-firebase`, `functions`. |
| `packages/` | Shared libraries/configs: `api-contracts`, `auth-client`, `utils`, `tsconfig`, `eslint-config`. |
| `infrastructure/` | Shared Dockerfiles (`containers/docker`), the shared nginx gateway image (`containers/compose`), database schemas/migrations (`database`, used by `supabase/`), cloud specs (`cloud`). |
| `scripts/` | Repo-wide dev/setup/docker scripts (see `scripts/README.md`). |
| `tests/e2e/` | Cross-product E2E suites (`auth-service`, `tms`). |

### Product layout

Every product uses the same top-level folders:

```
products/zolexora-<product>/
  apps/        frontends and mobile/desktop clients (web, admin, android, expo apps, edge workers)
  services/    backends and APIs (FastAPI, Express, NestJS, Frappe apps)
  packages/    product-local shared code (types, API clients, UI)
  scripts/     docker-start.sh (start|stop|restart|build|pull|status|logs) + product scripts
  docs/        product docs
  compose.yaml, Dockerfile.*, .infisical.json, README.md
```

Product notes: ERP's Frappe apps (including the `frappe`/`erpnext`/`payments` submodules) live in `services/frappe/`; IMS shares Python helpers via `services/shared/`; Zolexora AI's Python package is `services/api/backend/`; Maun Kavach's Android app is `apps/android/` (Gradle wrapper stays at the product root).

npm packages are named `@zolexora/<product>-<app>` (e.g. `@zolexora/tms-web`, `@zolexora/textile-care-admin-web`); product root packages are `@zolexora/<product>`. GHCR images are `ghcr.io/zolexora/zolexora-<product>-<service>`, built by `.github/workflows/zolexora-<product>-docker.yml`.

All Docker builds use the repo root as context (`context: ../../`, `dockerfile: products/<p>/Dockerfile.<svc>`); see `.agents/rules/docker-product-standards.md`.

## Dependency rules

1. Products may depend on `packages/*` and `platform/*`.
2. `packages/*` and `platform/*` never depend on a product.
3. A product never imports another product's internals; cross-product calls go through API contracts (`@zolexora/api-contracts`) or events.
4. A new shared package must replace code already duplicated in at least two products. After migrating, delete the local copy.
5. Breaking changes to a shared package must be validated against every consumer.

## What belongs in the platform

Platform-level (shared by all products): identity and authentication, organizations/memberships, product entitlements, Zolexora's own subscription billing, notifications delivery, custom domains/routing, cross-product webhooks, security audit logging. These are exposed through language-agnostic contracts (REST/events), because products span Python (FastAPI, Frappe), Node and Kotlin. Products never query platform databases directly.

Stays inside a product (never extracted):

- ERP business domains: accounting/GL, B2B/B2C invoicing, inventory, logistics, selling/CRM, manufacturing, and their data (orders, customers, items, invoices, payroll).
- Fine-grained business permissions (the platform only answers "may this org use product X?").
- Integrations that serve a single product (e.g. ERP bank reconciliation lives in `products/zolexora-erp/services/frappe/zolexora_integrations/`).

## Tenant naming

"Tenant" means a *renter* in Rento Easy and a *customer* in The Textile Care, so platform contracts use `organization_id` / `workspace_id` for B2B partitions and never a generic `tenant_id`.

## Identity

Three auth tracks (public user, org employee, platform admin) are served by `apps/zolexora-auth-service`; see [architecture/unified-firebase-auth-guide.md](architecture/unified-firebase-auth-guide.md) and the E2E spec in [`tests/e2e/auth-service/README.md`](../tests/e2e/auth-service/README.md).

## Further reading

- Decisions: [architecture/adrs/](architecture/adrs/)
- Infrastructure strategy (databases, deployment, API security, sharding): [architecture/infrastructure/](architecture/infrastructure/)
- Ports: [ports.md](ports.md)
- Secrets: [secrets.md](secrets.md)
