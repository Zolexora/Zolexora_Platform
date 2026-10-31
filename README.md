# Zolexora Platform

Monorepo for every Zolexora product plus the shared identity, admin and library code they use. pnpm workspace + Turborepo; each product runs as its own Docker Compose stack.

## Products

| Product | Path | What it is | Stack | Local gateway |
| --- | --- | --- | --- | --- |
| Zolexora Marketplace | `products/zolexora-marketplace` | Multi-storefront e-commerce (Zolexora Shop, Mahila Madel) + seller and admin portals | FastAPI, Next.js, Expo | :3079 |
| The Textile Care | `products/zolexora-textile-care` | Multi-tenant white-label laundry platform (customer, seller, driver, admin apps) | FastAPI, Next.js, Expo | :3080 |
| Zolexora TMS | `products/zolexora-tms` | Transport management (web, admin, mobile) | FastAPI, Vite, Expo | :3090 |
| Zolexora IMS | `products/zolexora-ims` | Multi-tenant inventory management | Cloudflare Workers + D1, FastAPI, Vite | :3072 |
| Zolexora ERP | `products/zolexora-erp` | ERP on Frappe/ERPNext (submodules) + Zolexora Frappe apps | Frappe, MariaDB | :8080 (root `compose.yaml`) |
| Zolexora IronClub | `products/zolexora-ironclub` | Gym & health-club management (admin, manager, marketing, member apps) | FastAPI, Vite, Expo | :8085 |
| Rento Easy | `products/zolexora-rentoeasy` | Property rental (tenant, owner, admin portals) | NestJS, Prisma, Vite | :3076 |
| Zolexora AppSuite | `products/zolexora-appsuite` | Client intake + dev-team console for commissioned apps | Next.js, Express | :3070 |
| Zolexora AI | `products/zolexora-ai` | Multi-agent "Swarm Factory" that turns requirements into codebases | FastAPI, Celery, Vite | :3091 |
| Zolexora Engage | `products/zolexora-engage` | WhatsApp dispatch for driver duty sheets | Express, Vite, Supabase | :3077 |
| ClarityFi | `products/zolexora-clarityfi` | Privacy-first personal finance + lifestyle tracker | Expo, Express | :3110 |
| Maun Kavach | `products/zolexora-maunkavach` | Encrypted messenger (Android client + Node backend + web) | Kotlin, Node, Vite | :3071 |

Shared: `apps/zolexora-auth-service` (central identity, :3081), `apps/zolexora-platform-admin` (:3095), `platform/*` and `packages/*`. Full layout and dependency rules: [docs/architecture.md](docs/architecture.md). All host ports: [docs/ports.md](docs/ports.md).

## Getting started

Prerequisites: Docker + Compose, Node 20+, pnpm 9 (`corepack enable`), Python 3.12 for FastAPI backends, and the Infisical CLI.

```bash
git submodule update --init --recursive   # ERP upstream (frappe, erpnext, payments)
pnpm install
infisical login                           # required: Infisical is the only secret source
./scripts/setup/start.sh                  # interactive: pick product(s) to run in Docker
```

Per-product commands are in root `package.json`, e.g.:

```bash
pnpm docker:tms:start      # start|stop|restart|build|pull|logs|status
pnpm docker:suite:start    # AppSuite
pnpm docker:admin:start    # Platform Admin
pnpm dev:tms               # dev server without Docker
pnpm docker:clean          # safe cleanup; pnpm docker:prune for deep cleanup (keeps devcontainer)
```

Stacks pull prebuilt images from `ghcr.io/zolexora/*` and only build when the image is missing. Add Docker scripts for a new product with `bash scripts/dev/scaffold-product-docker.sh <product>`.

## Secrets

Infisical is the only secret source: no `.env` files, no templates, no fallback ([ADR 0003](docs/architecture/adrs/0003-secrets-management-infisical.md)). Each product's `.infisical.json` names its folder, and every start script runs through `scripts/setup/with-infisical.sh`, which stops if you are not logged in. Required key names per product: [docs/secrets.md](docs/secrets.md). Run `pre-commit install` to enable the gitleaks hook.

## Tests

```bash
pnpm test                     # vitest for platform/
pnpm test:auth:service        # auth-service E2E (tests/e2e/auth-service/README.md)
bash tests/e2e/tms/run_all.sh # TMS E2E
```

Product backends have their own `pytest` suites under each product.

## Docs

- [docs/architecture.md](docs/architecture.md): layout, dependency rules, platform vs product boundaries
- [docs/ports.md](docs/ports.md): host port registry
- [docs/architecture/adrs/](docs/architecture/adrs/): decisions
- [docs/architecture/infrastructure/](docs/architecture/infrastructure/): infrastructure strategy
- [scripts/README.md](scripts/README.md): scripts
- [AGENTS.md](AGENTS.md): rules for AI agents
- Product docs: `products/<name>/README.md` and `products/<name>/docs/`
