# Host Port Registry

Source of truth: the `ports:` entries in each `compose.yaml` (verified 2026-10-31). Update this table in the same PR that changes a port.

## Rules

- Never bind host `5432` (reserved for the host OS). Expose Postgres as `${<PRODUCT>_POSTGRES_PORT:-54XX}:5432`.
- Expose the product gateway as `${<PRODUCT>_PORT:-30XX}:80`.
- Inside Docker, services talk on default ports (`postgres:5432`, `redis:6379`); only host bindings are offset.

## In use

| Product | Gateway (nginx) | Backend API | Postgres | Other | Defined in |
| --- | --- | --- | --- | --- | --- |
| Zolexora AppSuite | `3070` (`APPSUITE_PORT`), `3443` TLS; local dev: client `3073`, dev-team `3074`, backend `3078` | — | — | — | `apps/core-platform/zolexora-appsuite/compose.yaml` |
| Maun Kavach | `3071` (`MAUN_KAVACH_PORT`) | — | — | — | `apps/standalone-apps/maunkavach/compose.yaml` |
| Zolexora IMS | `3072` | — | — | — | `apps/core-platform/zolexora-ims/compose.yaml` |
| Rento Easy | `3076` | — | — | — | `apps/standalone-apps/rentoeasy/compose.yaml` |
| Zolexora Engage | `3077` | — | — | — | `apps/core-platform/zolexora-engage/compose.yaml` |
| Zolexora Shop | `3079` | — | — | — | `apps/core-platform/zolexora-shop/compose.yaml` |
| Zolexora Shop (API tests) | — | — | `5434` (`MARKETPLACE_TEST_POSTGRES_PORT`, 127.0.0.1, throwaway) | — | `apps/core-platform/zolexora-shop/services/marketplace-api/tests/postgres-test.compose.yml` |
| The Textile Care | `3080` | — | — | — | `apps/standalone-apps/textile-care/compose.yaml` |
| Auth Service | — | `3081` (`AUTH_SERVICE_PORT`) | — (Supabase) | — | `apps/zolexora-auth-service/compose.yaml` |
| Zolexora TMS | `3090` (`TMS_PORT`) | `4031` (`TMS_BACKEND_PORT`) | — | — | `apps/core-platform/zolexora-tms/compose.yaml` |
| Zolexora AI | `3091` | `4090` | — | — | `apps/core-platform/zolexora-ai/compose.yaml` |
| Platform Admin | `3095` (`PLATFORM_ADMIN_GATEWAY_PORT`; `pnpm dev:admin` uses it too), frontend `3092` (localhost only) | `4041` (localhost only) | — (Supabase) | — | `apps/zolexora-platform-admin/compose.yaml` |
| ClarityFi | `3110` (`CLARITYFI_PORT`) | — | — | — | `apps/standalone-apps/clarityfi/compose.yaml` |
| Zolexora IronClub | `8085` | `4060` | `5452` (`IRONCLUB_POSTGRES_PORT`) | Redis `6382` | `apps/standalone-apps/ironclub/compose.yaml` |
| Zolexora ERP | `8080` / `8443` (`HTTP_PORT`/`HTTPS_PORT`) | Frappe `8000` (`FRAPPE_PORT`) | — | — | `apps/core-platform/zolexora-erp/compose.yaml` (secrets from Infisical `Zolexora_ERP`) |

Gateways not listed expose no other host ports; their APIs and databases are reachable only inside the Docker network.

## Known problems

- IronClub hardcodes `4060` and `8085` instead of env-overridable offsets.
- `.devcontainer/devcontainer.json` `forwardPorts` is out of date with this table.

## Free gateway ports

`3082`–`3089`, `3093`, `3094`, `3096`–`3099`. Postgres `5433`, `5435`–`5449` and `5451` are free.
