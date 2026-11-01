# Products

Each product is an independent stack under `products/zolexora-<product>/` using the standard layout (`apps/`, `services/`, `packages/`, `scripts/`, `docs/`; see [docs/architecture.md](../docs/architecture.md#product-layout)). Ports: [docs/ports.md](../docs/ports.md). Secrets: [docs/secrets.md](../docs/secrets.md).

| Product | Path | What it is | Docker scripts |
| --- | --- | --- | --- |
| Zolexora Marketplace | [`zolexora-marketplace/`](zolexora-marketplace/) | Ecom marketplace app: Zolexora Shop + Mahila Madel storefronts, seller and admin portals | `docker:marketplace:*` |
| The Textile Care | [`zolexora-textile-care/`](zolexora-textile-care/) | Laundry app: multi-tenant white-label (customer, seller, driver, admin) | `docker:ttc:*` |
| Zolexora TMS | [`zolexora-tms/`](zolexora-tms/) | Transport management (web, admin, mobile) | `docker:tms:*` |
| Zolexora IMS | [`zolexora-ims/`](zolexora-ims/) | Multi-tenant inventory management | `docker:ims:*` |
| Zolexora ERP | [`zolexora-erp/`](zolexora-erp/) | ERP on Frappe/ERPNext + Zolexora Frappe apps | `docker:erp:*` |
| Zolexora IronClub | [`zolexora-ironclub/`](zolexora-ironclub/) | Gym and health-club management | `docker:ironclub:*` |
| Rento Easy | [`zolexora-rentoeasy/`](zolexora-rentoeasy/) | Property rental (tenant, owner, admin) | `docker:rentoeasy:*` |
| Zolexora AppSuite | [`zolexora-appsuite/`](zolexora-appsuite/) | Client intake + dev-team console for commissioned apps | `docker:suite:*` |
| Zolexora AI | [`zolexora-ai/`](zolexora-ai/) | Multi-agent "Swarm Factory": requirements to codebases | `docker:ai:*` |
| Zolexora Engage | [`zolexora-engage/`](zolexora-engage/) | WhatsApp dispatch for driver duty sheets | `docker:engage:*` |
| ClarityFi | [`zolexora-clarityfi/`](zolexora-clarityfi/) | Privacy-first personal finance + lifestyle tracker | `docker:clarityfi:*` |
| Maun Kavach | [`zolexora-maunkavach/`](zolexora-maunkavach/) | Encrypted messenger (Android, Node backend, web) | `docker:maunkavach:*` |

`*` = `start|stop|restart|build|pull|logs|status`. Add a product with `bash scripts/dev/scaffold-product-docker.sh <product>`.
