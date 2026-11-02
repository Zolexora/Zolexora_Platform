# Zolexora Engage

WhatsApp dispatch tool (formerly "FleetRelay"): import a driver duty sheet, personalise a message per driver, send it via the WhatsApp Cloud API, and track delivery status.

## Code layout

```text
apps/web/                   # Vite + React dispatcher UI (@zolexora/engage-web)
  src/app/                  # Providers and routing
  src/features/auth/        # Supabase auth gate and login UI
  src/features/dispatch/    # Duty-sheet import, queue, and WhatsApp dispatch
  src/components/ui/        # Shared UI primitives
services/api/               # Express API (@zolexora/engage-api-server)
  src/App.ts                # Middleware and API assembly
  src/routes/               # Health.ts, WhatsApp.ts
packages/
  api-spec/                 # OpenAPI source
  api-zod/                  # Generated request/response schemas
  api-client-react/         # Generated frontend API client
  db/                       # Drizzle setup
```

Local Docker stack: `compose.yaml` (nginx gateway on http://localhost:3077), built from `Dockerfile.api`, `Dockerfile.web`, `Dockerfile.nginx`.

## Deployment

The recommended free deployment separates the public frontend from the API:

- **Frontend:** Cloudflare Pages, built from `products/zolexora-engage/apps/web`
- **API:** Render Web Service built from `Dockerfile.api`
- **Database and authentication:** Supabase
- **WhatsApp webhook:** the public Render API URL at
  `/api/whatsapp/webhook`

### Render API

Create a Render Web Service from `products/zolexora-engage/Dockerfile.api`
(build context: repo root) with `/api/healthz` as the health check. Set secrets
in the Render dashboard; never commit them to the repository.

### Cloudflare Pages frontend

Use these build settings:

```text
Root directory: /
Build command: pnpm install --frozen-lockfile && pnpm --filter @zolexora/engage-web build
Build output directory: products/zolexora-engage/apps/web/dist
```

Set these Pages environment variables for the production environment:

```text
VITE_API_URL=https://<your-render-api>.onrender.com
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>
```

After deployment, set the Supabase Auth site URL and redirect URL to the
Cloudflare Pages HTTPS URL. Configure the Meta WhatsApp webhook as:

```text
https://<your-render-api>.onrender.com/api/whatsapp/webhook
```

## Run with Docker

```bash
./scripts/start-project.sh   # secrets from Infisical: /Zolexora_Engage
```

The stack is served through nginx at <http://localhost:3077>. Stop with `Ctrl+C`; remove containers with `docker compose -f products/zolexora-engage/compose.yaml down`.

For local Vite development:

```bash
./scripts/start-web-dev.sh
```

## Duty sheet format

Import an `.xlsx`, `.xls`, or `.csv` file with one row per driver. The sheet
must include these columns:

- `Vehicle Number`
- `Driver Name`
- `Mobile Number`
- `Pending Duty Count`

Column names are matched case-insensitively and spaces/punctuation are ignored.
Rows missing any required value are rejected so only complete rows can be sent
through WhatsApp.

WhatsApp server credentials are injected only into the API, from Infisical:

- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`

Never place the access token in frontend code, Excel files, or GitHub. Generate
a new Meta access token if one has been exposed.