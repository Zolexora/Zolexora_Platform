# Apps

Cross-product apps: [`auth-service/`](auth-service/) (sign-in for every product) and [`platform-admin/`](platform-admin/) (platform admin console).

## Products

Each product is an independent stack under `apps/platform-core/zolexora-<product>/` or `apps/platform-apps/<product>/` using the standard layout (`apps/`, `services/`, `packages/`, `scripts/`, `docs/`; see [docs/architecture.md](../docs/architecture.md#product-layout)). Ports: [docs/ports.md](../docs/ports.md). Secrets: [docs/secrets.md](../docs/secrets.md).

### Core platform — `platform-core/`

Zolexora's own business platforms (folders keep the `zolexora-` prefix).

| Product | Path | What it is | Docker scripts |
| --- | --- | --- | --- |
| Zolexora TMS | [`platform-core/zolexora-tms/`](platform-core/zolexora-tms/) | Transport management (web, admin, mobile) | `docker:tms:*` |
| Zolexora IMS | [`platform-core/zolexora-ims/`](platform-core/zolexora-ims/) | Multi-tenant inventory management | `docker:ims:*` |
| Zolexora ERP | [`platform-core/zolexora-erp/`](platform-core/zolexora-erp/) | ERP on Frappe/ERPNext + Zolexora Frappe apps | `docker:erp:*` |
| Zolexora AppSuite | [`platform-core/zolexora-appsuite/`](platform-core/zolexora-appsuite/) | Client intake + dev-team console for commissioned apps | `docker:suite:*` |
| Zolexora AI | [`platform-core/zolexora-ai/`](platform-core/zolexora-ai/) | Multi-agent "Swarm Factory": requirements to codebases | `docker:ai:*` |
| Zolexora Engage | [`platform-core/zolexora-engage/`](platform-core/zolexora-engage/) | WhatsApp dispatch for driver duty sheets | `docker:engage:*` |

### Standalone apps — `platform-apps/`

Independent consumer and vertical apps (folders without the prefix).

| Product | Path | What it is | Docker scripts |
| --- | --- | --- | --- |
| Zolexora Shop | [`platform-apps/marketplace/`](platform-apps/marketplace/) | Ecom marketplace app: Zolexora Shop + Mahila Madel storefronts, seller and admin portals | `docker:shop:*` |
| The Textile Care | [`platform-apps/textile-care/`](platform-apps/textile-care/) | Laundry app: multi-tenant white-label (customer, seller, driver, admin) | `docker:ttc:*` |
| Zolexora IronClub | [`platform-apps/ironclub/`](platform-apps/ironclub/) | Gym and health-club management | `docker:ironclub:*` |
| Rento Easy | [`platform-apps/rentoeasy/`](platform-apps/rentoeasy/) | Property rental (tenant, owner, admin) | `docker:rentoeasy:*` |
| ClarityFi | [`platform-apps/clarityfi/`](platform-apps/clarityfi/) | Privacy-first personal finance + lifestyle tracker | `docker:clarityfi:*` |
| Maun Kavach | [`platform-apps/maunkavach/`](platform-apps/maunkavach/) | Encrypted messenger (Android, Node backend, web) | `docker:maunkavach:*` |
| PostCread | [`platform-apps/postcread/`](platform-apps/postcread/) | Reels app (placeholder, no code yet) | — |

`*` = `start|stop|restart|build|pull|logs|status`. Add a product with `bash scripts/dev/scaffold-product-docker.sh <product>`.
