# Zolexora IMS

Inventory and point of sale for businesses on the Zolexora platform. People sign in through the
Zolexora auth service; each business's data lives in one SQLite database, keyed by its Zolexora business id.

| Part | Path | Image |
| --- | --- | --- |
| Web app (React + Vite, served by nginx) | `apps/ims-user/frontend` | `ghcr.io/zolexora/zolexora-ims-user-frontend` |
| API (FastAPI) | `services/user-api` | `ghcr.io/zolexora/zolexora-ims-user-backend` |

Secrets come only from Infisical (`/Zolexora_IMS`); see [docs/secrets.md](../../docs/secrets.md).

## Images

Images are built only by GitHub CI ([zolexora-ims-docker.yml](../../.github/workflows/zolexora-ims-docker.yml))
and pushed to GHCR: `:latest` from `main`, `:<branch>` from a manual run on another branch, and `:<commit sha>`.
They are never built locally, and they hold nothing host-specific: every setting is read from the
environment when the container starts, so the same images run on Docker, a VPS, Render or any other host.

## Run locally (Docker)

```bash
bash products/zolexora-ims/scripts/docker-start.sh start    # pull from GHCR, then up -d (via Infisical)
bash products/zolexora-ims/scripts/docker-start.sh {stop|restart|pull|status|logs}
```

The app is on http://localhost:3072 (`IMS_PORT`). Without Docker: `pnpm --filter @zolexora/ims-user-frontend dev`
and `uvicorn main:app --port 4050` in `services/user-api`, both run through `scripts/setup/with-infisical.sh`.

## Deploy anywhere

Run the two images and give them this environment (values from Infisical):

**API** — `zolexora-ims-user-backend`, listens on `PORT` (default `4050`), health: `GET /health`

| Variable | What |
| --- | --- |
| `DATABASE_PATH` | SQLite file; the image sets `/data/ims.db`. **Mount a persistent disk or volume at `/data`**, or data is lost when the container is replaced |
| `AUTH_SERVICE_URL` | Auth service base URL as the API reaches it |
| `IMS_PRODUCT_KEY` | Product key for registering the `ims:*` permission catalog |

**Web** — `zolexora-ims-user-frontend`, listens on `PORT` (default `3000`), health: `GET /healthz`

| Variable | What |
| --- | --- |
| `IMS_API_URL` | The API's base URL with no trailing `/`, e.g. `http://ims-user-backend:4050` or `https://ims-api.example.com`; the web container proxies `/api/` to it |
| `AUTH_SERVICE_PUBLIC_URL` | Auth service URL as the browser reaches it |
| `TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key |
| `NEXT_PUBLIC_IMS_CLIENT_FIREBASE_API_KEY`, `…_AUTH_DOMAIN`, `…_APP_ID`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | IMS Firebase web app |

Expose only the web container publicly; payment and aggregator webhooks reach the API through it at
`https://<web host>/api/v1/...`. On the auth service, add the web origin to `CORS_ORIGIN` and an `ims=` entry to
`CATALOG_PRODUCT_KEYS`. On a Docker host, [.github/scripts/deploy.sh](../../.github/scripts/deploy.sh) rolls one
service to a given image tag. Check any deployment with `IMS_URL=https://<web host> bash scripts/check-health.sh`.

## Scripts

| Script | Does |
| --- | --- |
| `scripts/docker-start.sh` | Start / stop / pull the local stack |
| `scripts/db-ops.sh` | SQLite `status`, `query`, `backup`, `restore` on the running stack (backups go to `~/zolexora-ims-backups`) |
| `scripts/check-health.sh` | Probe the web app and API |
| `scripts/run-all-tests.sh` | Backend tests, typecheck, build |
| `scripts/setup.sh`, `scripts/menu.sh` | First-time setup and a menu over the above |

## Database

SQLite, one file for all businesses (every row and key starts with `org_id`). The API creates the tables on start
from `services/user-api/schema.sql` and runs in WAL mode; a sale is written in one transaction. Locally the file is
on the `ims-data` Docker volume (kept by `stop`, `docker:clean` and `docker:prune`). SQLite allows one writer, so
run **one API instance** per database file; take backups with `scripts/db-ops.sh backup` (or snapshot the disk).
