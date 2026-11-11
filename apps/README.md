# Apps

Cross-product apps: [`zolexora-auth-service/`](zolexora-auth-service/) (sign-in for every product) and [`zolexora-platform-admin/`](zolexora-platform-admin/) (platform admin console).

## Products

Each product is an independent stack under `apps/core-platform/zolexora-<product>/` or `apps/standalone-apps/<product>/` using the standard layout (`apps/`, `services/`, `packages/`, `scripts/`, `docs/`; see [docs/architecture.md](../docs/architecture.md#product-layout)). Ports: [docs/ports.md](../docs/ports.md). Secrets: [docs/secrets.md](../docs/secrets.md).

### Core platform — `core-platform/`

Zolexora's own business platforms (folders keep the `zolexora-` prefix).

| Product | Path | What it is | Docker scripts |
| --- | --- | --- | --- |
| Zolexora Shop | [`core-platform/zolexora-shop/`](core-platform/zolexora-shop/) | Ecom marketplace app: Zolexora Shop + Mahila Madel storefronts, seller and admin portals | `docker:shop:*` |
| Zolexora TMS | [`core-platform/zolexora-tms/`](core-platform/zolexora-tms/) | Transport management (web, admin, mobile) | `docker:tms:*` |
| Zolexora IMS | [`core-platform/zolexora-ims/`](core-platform/zolexora-ims/) | Multi-tenant inventory management | `docker:ims:*` |
| Zolexora ERP | [`core-platform/zolexora-erp/`](core-platform/zolexora-erp/) | ERP on Frappe/ERPNext + Zolexora Frappe apps | `docker:erp:*` |
| Zolexora AppSuite | [`core-platform/zolexora-appsuite/`](core-platform/zolexora-appsuite/) | Client intake + dev-team console for commissioned apps | `docker:suite:*` |
| Zolexora AI | [`core-platform/zolexora-ai/`](core-platform/zolexora-ai/) | Multi-agent "Swarm Factory": requirements to codebases | `docker:ai:*` |
| Zolexora Engage | [`core-platform/zolexora-engage/`](core-platform/zolexora-engage/) | WhatsApp dispatch for driver duty sheets | `docker:engage:*` |

### Standalone apps — `standalone-apps/`

Independent consumer and vertical apps (folders without the prefix).

| Product | Path | What it is | Docker scripts |
| --- | --- | --- | --- |
| The Textile Care | [`standalone-apps/textile-care/`](standalone-apps/textile-care/) | Laundry app: multi-tenant white-label (customer, seller, driver, admin) | `docker:ttc:*` |
| Zolexora IronClub | [`standalone-apps/ironclub/`](standalone-apps/ironclub/) | Gym and health-club management | `docker:ironclub:*` |
| Rento Easy | [`standalone-apps/rentoeasy/`](standalone-apps/rentoeasy/) | Property rental (tenant, owner, admin) | `docker:rentoeasy:*` |
| ClarityFi | [`standalone-apps/clarityfi/`](standalone-apps/clarityfi/) | Privacy-first personal finance + lifestyle tracker | `docker:clarityfi:*` |
| Maun Kavach | [`standalone-apps/maunkavach/`](standalone-apps/maunkavach/) | Encrypted messenger (Android, Node backend, web) | `docker:maunkavach:*` |

`*` = `start|stop|restart|build|pull|logs|status`. Add a product with `bash scripts/dev/scaffold-product-docker.sh <product>`.
