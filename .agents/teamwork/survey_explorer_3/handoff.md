# Survey Explorer 3: Architecture Analysis & Specification Report
**Domain**: Backend & Frontend Architecture Requirements, API Schemas, Test Strategy, and Container Orchestration
**Scope**: Zolexora Platform Admin Control Plane (`apps/platform-admin`) Requirements R1–R5

---

## 1. Observation

Direct inspection of the repository source files, configuration files, and architecture documentation reveals the current state and exact gaps:

### 1.1 Authoritative Request & Specifications
- **Authoritative Request (`ORIGINAL_REQUEST.md`, lines 105–172)**: Mandates building and implementing the Zolexora Platform Admin control plane (`apps/platform-admin`) consisting of:
  - R1: Central Database Connection & Telemetry Router (FastAPI backend on port `3081`, multi-tenant routing across 4 Supabase projects via Supavisor pooler port 6543, MongoDB Atlas pooling for `db_ai`, `db_tms`, `db_engage`, Cloudflare R2 presigned URL generation, and real-time capacity monitoring against 500MB Postgres / 512MB MongoDB thresholds).
  - R2: Dynamic Account Router & Infisical Secrets Sync (Runtime account discovery across Firebase, Cloudflare, DB clusters from Infisical `/shared/`, `/platform-admin/` or `.env`, 90% quota throttling/failover, missing credential diagnostics).
  - R3: Multi-Provider Email Router & Log Collector (Intelligent routing and failover across Resend, Brevo, SendGrid, tracking daily quotas, permanent MongoDB archiving in `email_logs`).
  - R4: Command Center Fleet Dashboard (Next.js 14 on port `3082` querying backend on port `3081`, Fleet Overview across P1/P2, Database Capacity gauges, Dynamic Account Manager, Email Operations Panel).
  - R5: Monorepo Port Standard & Container Orchestration (Strict ports: Frontend `3082`, Backend `3081`, Postgres `5440`; `compose.yaml` with prebuilt image tags `ghcr.io/zolexora/platform-admin-*`, `pull_policy: missing`, container healthchecks; root `package.json` scripts).

### 1.2 Existing Backend Implementation & Gaps
- **Backend Entrypoint (`apps/platform-admin/backend/app/main.py`, lines 1–22)**:
  - Only contains an initial stub:
    ```python
    @app.get("/api/health")
    def health_check():
        return {"status": "ok", "service": "platform-admin-backend", "framework": "fastapi"}
    ```
  - Missing all required functional endpoints: `GET /api/health/databases`, `GET /api/accounts`, `POST /api/accounts/sync`, `GET /api/telemetry/capacity`, `POST /api/email/send`, `GET /api/email/quotas`, `GET /api/email/logs`, and `POST /api/storage/presigned-url`.
- **Backend Dependencies (`apps/platform-admin/backend/requirements.txt`, lines 1–4)**:
  - Only declares `fastapi>=0.110.0`, `uvicorn[standard]>=0.29.0`, `pydantic>=2.7.0`.
  - Missing required libraries explicitly required by R1 and R3: `asyncpg`, `motor`, `boto3`, `httpx`, `supabase`, `pytest`, `pytest-asyncio`.
- **Database Routing & Connection Config (`apps/platform-admin/backend/app/db/config.py` & `connections.py`)**:
  - `PRODUCT_DB_MAP` (lines 9–72) maps 11 products to 4 Supabase projects (`core`, `commerce`, `business`, `ai_erp`) with schemas and `pool_port: 6543`.
  - `MONGO_DB_MAP` (lines 74–78) maps `zolexora-ai` -> `db_ai`, `zolexora-tms` -> `db_tms`, `zolexora-engage` -> `db_engage`.
  - `get_supabase_url` and `get_supabase_key` throw unhandled `ValueError` when environment variables are absent (lines 91, 100), violating R1's requirement: *"Graceful non-blocking degradation: return clear degraded health payloads if credentials are missing rather than throwing unhandled exceptions"*.
  - `get_r2_url` in `connections.py` (lines 71–80) is an unimplemented stub returning a hardcoded mock URL instead of integrating `boto3`.

### 1.3 Existing Frontend Implementation & Gaps
- **Frontend Package (`apps/platform-admin/frontend/package.json`, lines 1–28)**:
  - Configured with `next: "14.2.3"`, `react: "18.3.1"`, `tailwindcss: "^3.4.3"`.
  - Script `"test": "echo 'No tests yet'"` (line 10).
- **Frontend Page (`apps/platform-admin/frontend/src/app/page.tsx`, lines 1–9)**:
  - Only contains static placeholder text ("Platform Admin Panel - Centralized dashboard for all Zolexora products.").
  - None of the 4 required panels (Fleet Overview, Database & Storage Capacity, Dynamic Account Manager, Email Operations Panel) are implemented.
- **Frontend Layout (`apps/platform-admin/frontend/src/app/layout.tsx`, lines 1–9)**:
  - Minimal container without navigation tabs, sidebars, diagnostic alert headers, or API provider context.

### 1.4 Existing Compose & Port Registry
- **Compose Specification (`apps/platform-admin/compose.yaml`, lines 1–51)**:
  - Port bindings: `platform-admin-frontend` binds `3082:3000`, `platform-admin-backend` binds `3081:8000`.
  - Gaps vs R5:
    - Missing prebuilt image tags: uses only `build:` instead of `image: ${PLATFORM_ADMIN_BACKEND_IMAGE:-ghcr.io/zolexora/platform-admin-backend:latest}` and `image: ${PLATFORM_ADMIN_FRONTEND_IMAGE:-ghcr.io/zolexora/platform-admin-frontend:latest}`.
    - Missing `pull_policy: missing`.
    - Missing dedicated `platform-admin-postgres` container on isolated port `5440` (`${PLATFORM_ADMIN_POSTGRES_PORT:-5440}:5432`) required by `14-monorepo-port-allocation-registry.md` (line 29: `Platform Admin | ADMIN | Frontend: 3082 | Backend API: 3081 | PostgreSQL (Host Offset): 5440`).
- **Root Scripts (`package.json`, lines 5–44)**:
  - Currently contains scripts for `tms` and `ironclub`, but has no dedicated package scripts for `platform-admin` (e.g., `dev:admin:api`, `dev:admin:frontend`, `build:admin:frontend`, `docker:admin:start`, `docker:admin:stop`).

---

## 2. Logic Chain

From the observations above, we establish the technical requirements, schemas, test strategies, UI architecture, and container configurations:

### 2.1 Backend Architecture & API Schemas Specification

To satisfy R1, R2, and R3, the FastAPI backend must expose a modular router architecture (`app/routers/`):
1. `routers/health.py`: System health and multi-database connectivity probes.
2. `routers/accounts.py`: Runtime Infisical/local discovery, quota tracking, status toggling, and secret re-sync.
3. `routers/telemetry.py`: Free-tier storage capacity calculation (PostgreSQL 500MB, MongoDB 512MB) and hot table profiling.
4. `routers/email.py`: Multi-provider transactional email sending gateway (Resend -> Brevo -> SendGrid failover) and permanent MongoDB log reader.
5. `routers/storage.py`: Presigned S3/R2 URL generation using `boto3`.

#### Complete Pydantic Models & Endpoint Specifications

```python
# app/schemas/health.py
from pydantic import BaseModel, Field
from typing import Dict, Optional, Literal

class SystemHealthResponse(BaseModel):
    status: Literal["healthy", "degraded", "unhealthy"]
    service: str = "platform-admin-backend"
    version: str = "1.0.0"
    environment: str
    timestamp: str

class DatabaseTargetHealth(BaseModel):
    target: str                          # e.g., "supabase_core", "mongodb_atlas"
    status: Literal["healthy", "degraded", "unhealthy", "unconfigured"]
    latency_ms: int                      # -1 if degraded/unreachable
    details: Optional[str] = None
    error: Optional[str] = None

class DatabaseHealthReport(BaseModel):
    overall_status: Literal["healthy", "degraded", "unhealthy"]
    targets: Dict[str, DatabaseTargetHealth]
    timestamp: str
```

```python
# app/schemas/accounts.py
from pydantic import BaseModel, Field
from typing import List, Optional, Literal

AccountStatus = Literal["ACTIVE", "DRAINING", "DISCONNECTED", "QUOTA_THROTTLED"]
ProviderType = Literal["firebase", "cloudflare", "supabase", "mongodb", "resend", "brevo", "sendgrid"]

class DiscoveredAccount(BaseModel):
    id: str                              # e.g., "tms-prod", "cf-acc-1"
    provider: ProviderType
    alias: str
    project_id_or_account_id: str
    status: AccountStatus
    monthly_quota_total: Optional[int] = None
    monthly_quota_used: Optional[int] = None
    daily_quota_total: Optional[int] = None
    daily_quota_used: Optional[int] = None
    quota_percentage: float = 0.0
    latency_ms: Optional[int] = None
    last_synced_at: str

class AccountSyncResponse(BaseModel):
    status: Literal["success", "partial", "failed"]
    discovered_count: int
    active_count: int
    throttled_count: int
    disconnected_count: int
    diagnostics: List[str] = []
    timestamp: str

class AccountDiagnosticAlert(BaseModel):
    event: str = "ROUTER_CREDENTIAL_MISSING"
    severity: Literal["INFO", "WARNING", "CRITICAL"]
    provider: str
    target_product: str
    expected_secret: str
    infisical_path: str
    message: str
    timestamp: str
```

```python
# app/schemas/telemetry.py
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Literal

class HotTableMetric(BaseModel):
    schema_name: str                     # e.g., "ims", "marketplace", "tms"
    table_name: str                      # e.g., "products", "sellers", "shipments"
    row_count_estimate: int
    total_bytes: int
    total_size_pretty: str               # e.g., "14.2 MB"
    read_activity_score: Optional[int] = None

class StorageQuotaMetric(BaseModel):
    service: str                         # "supabase_postgresql" | "mongodb_atlas"
    project_or_cluster: str              # "core", "commerce", "business", "ai_erp", "cluster0"
    free_tier_limit_bytes: int           # 524,288,000 (500MB) or 536,870,912 (512MB)
    used_bytes: int
    used_pretty: str
    usage_percentage: float
    threshold_state: Literal["NORMAL", "WARNING", "CRITICAL"] # WARNING at >80%, CRITICAL at >90%
    tables: Optional[List[HotTableMetric]] = None

class CapacityTelemetryResponse(BaseModel):
    databases: List[StorageQuotaMetric]
    overall_threshold_alert: bool
    hot_tables: List[HotTableMetric]
    timestamp: str
```

```python
# app/schemas/email.py
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Literal, Dict, Any

class EmailSendRequest(BaseModel):
    product: str                         # e.g. "zolexora-ims", "zolexora-tms"
    to: List[EmailStr]
    subject: str
    html_content: Optional[str] = None
    text_content: Optional[str] = None
    sender_name: Optional[str] = "Zolexora Platform"
    sender_email: Optional[EmailStr] = None
    metadata: Optional[Dict[str, Any]] = None

class EmailSendResponse(BaseModel):
    success: bool
    message_id: str
    provider_used: Literal["resend", "brevo", "sendgrid"]
    account_used: str
    status: Literal["queued", "sent", "failed"]
    attempt_count: int
    timestamp: str

class ProviderQuotaMetric(BaseModel):
    provider: Literal["resend", "brevo", "sendgrid"]
    account_id: str
    daily_limit: int                     # Resend: 100, Brevo: 300, SendGrid: 100
    daily_used: int
    remaining_today: int
    usage_percentage: float
    is_throttled: bool

class EmailLogRecord(BaseModel):
    id: str
    message_id: str
    provider: str
    account: str
    product: str
    recipient: str
    subject: str
    status: Literal["queued", "sent", "delivered", "bounced", "failed"]
    sent_at: str
    bounce_reason: Optional[str] = None
    opened: bool = False
```

```python
# app/schemas/storage.py
from pydantic import BaseModel, Field
from typing import Literal

class PresignedUrlRequest(BaseModel):
    product: str                         # "ims", "marketplace", "tms"
    file_key: str                        # "invoices/2026/inv-001.pdf"
    operation: Literal["get_object", "put_object"] = "get_object"
    expiry_seconds: int = 3600

class PresignedUrlResponse(BaseModel):
    url: str
    bucket: str
    file_key: str
    expires_in_seconds: int
```

#### Non-Blocking Graceful Degradation Logic
To prevent crashes during startup or network partitions:
- Whenever `SUPABASE_<PROJECT>_URL` or `SUPABASE_<PROJECT>_SERVICE_KEY` is missing from environment variables / Infisical, `check_supabase_health` returns:
  ```json
  {
    "status": "unconfigured",
    "latency_ms": -1,
    "details": "Missing environment variables: SUPABASE_CORE_URL / SERVICE_KEY"
  }
  ```
- The endpoint `GET /api/health/databases` returns HTTP 200 with `overall_status: "degraded"` rather than throwing unhandled 500 exceptions.
- Similarly, if `MONGO_URI` is unconfigured, MongoDB health reports `unconfigured` and email logging safely buffers to local append log or falls back to stderr logging with a structured alert event.

#### Intelligent Multi-Provider Email Failover Algorithm
1. The Router maintains in-memory and MongoDB-synced daily counters for:
   - Primary: Resend accounts (100 emails/day per account).
   - Secondary: Brevo accounts (300 emails/day per account).
   - Tertiary: SendGrid accounts (100 emails/day per account).
2. When a dispatch request is received:
   - If Resend account daily usage is `< 90%` (90 emails) and provider is healthy, dispatch via Resend.
   - If Resend reaches `>= 90%` or returns HTTP 429 / quota error, mark account `QUOTA_THROTTLED` and route to Brevo.
   - If Brevo reaches `>= 90%` or errors, route to SendGrid.
   - If all accounts are throttled or network fails, persist failed record to MongoDB and return structured error response with status code 503 and diagnostic alert.
3. Every sent email is asynchronously inserted into MongoDB `email_logs` collection via `AsyncIOMotorClient`.

---

### 2.2 Test Strategy Specification (Pytest & Integration)

The test suite must be co-located in `apps/platform-admin/backend/tests/` and adhere to FastAPI / Pytest conventions:

```
apps/platform-admin/backend/
├── tests/
│   ├── conftest.py                     # Mock fixtures, TestClient, test environment vars
│   ├── test_health.py                  # /api/health & /api/health/databases degradation
│   ├── test_router.py                  # Database routing resolution & Supavisor 6543
│   ├── test_accounts.py                # Runtime discovery, Infisical mock, 90% throttling
│   ├── test_telemetry.py               # 500MB / 512MB capacity calculation & hot table profiling
│   ├── test_email.py                   # Multi-provider routing, failover, MongoDB logging
│   └── test_storage.py                 # Cloudflare R2 presigned URL generation (boto3)
```

#### Test Suite Implementation Details

1. **`conftest.py`**:
   - Sets mock environment variables for test execution:
     - `SUPABASE_CORE_URL=https://core.mock.supabase.co`
     - `SUPABASE_CORE_SERVICE_KEY=mock-core-key`
     - `SUPABASE_COMMERCE_URL=https://commerce.mock.supabase.co`
     - `SUPABASE_COMMERCE_SERVICE_KEY=mock-commerce-key`
     - `MONGO_URI=mongodb://localhost:27017`
     - `RESEND_API_KEY=mock-resend-key`
     - `BREVO_API_KEY=mock-brevo-key`
     - `SENDGRID_API_KEY=mock-sendgrid-key`
   - Configures `TestClient(app)` with dependency overrides or `httpx.AsyncClient` for async endpoints.
   - Provides a `mock_mongo` fixture using `unittest.mock.AsyncMock` or `mongomock_motor`.
   - Provides a `mock_boto3` fixture for Cloudflare R2 presigned URL mocking.

2. **`test_health.py`**:
   - `test_system_health`: Asserts `GET /api/health` returns HTTP 200 with `status == "ok"` and `service == "platform-admin-backend"`.
   - `test_database_health_full_credentials`: Mock successful database ping; asserts all targets return `status == "healthy"` with positive latency.
   - `test_database_health_graceful_degradation_missing_secrets`: Unset all Supabase & Mongo env vars; verify `GET /api/health/databases` returns HTTP 200 (not 500), `overall_status == "degraded"`, and targets report `"unconfigured"` or `"degraded"`.

3. **`test_router.py`**:
   - `test_product_to_supabase_mapping`: Verifies every product in `PRODUCT_DB_MAP` maps to the exact intended Supabase project (`core`, `commerce`, `business`, `ai_erp`), schema, and `pool_port == 6543`.
   - `test_unknown_product_rejection`: Querying an unregistered product raises or returns clean HTTP 404 / 400.
   - `test_mongo_db_mapping`: Verifies `zolexora-ai` maps to `db_ai`, `zolexora-tms` to `db_tms`, `zolexora-engage` to `db_engage`.

4. **`test_accounts.py`**:
   - `test_dynamic_account_discovery`: Discovers active accounts from env/manifest; verifies `status` defaults to `ACTIVE`.
   - `test_account_quota_throttling`: When account usage exceeds 90% (e.g. 9,100 / 10,000), account status is marked as `QUOTA_THROTTLED`.
   - `test_manual_sync_trigger`: `POST /api/accounts/sync` triggers dynamic reload and returns discovery counts.

5. **`test_telemetry.py`**:
   - `test_storage_capacity_metrics`: Calculates percentages against 500MB (Postgres) and 512MB (Mongo).
   - `test_threshold_alert_trigger`: When database size > 450MB (>90%), `threshold_state` switches to `CRITICAL` and `overall_threshold_alert` becomes `True`.
   - `test_hot_table_profiling`: Returns sorted list of top tables by size with schema namespaces.

6. **`test_email.py`**:
   - `test_email_send_primary_success`: Resend is healthy and `<90%` quota; email dispatches via Resend, MongoDB `email_logs` collection receives new record.
   - `test_email_send_failover_to_brevo`: Resend returns 429 or is at 95% quota; router automatically switches to Brevo and records `provider_used == "brevo"`.
   - `test_email_send_failover_to_sendgrid`: Resend and Brevo both exhausted; router switches to SendGrid.
   - `test_email_send_all_exhausted_graceful_failure`: All providers fail; endpoint returns HTTP 503, records failed attempt in logs without crashing.
   - `test_email_logs_query`: `GET /api/email/logs` supports filtering by product, provider, and pagination.

---

### 2.3 Frontend Dashboard Requirements Specification (Next.js 14 Fleet Management)

The frontend is a Next.js 14 App Router application (`apps/platform-admin/frontend/`) styled with Tailwind CSS, running on port `3082`.

#### Architecture & Component Hierarchy

```
apps/platform-admin/frontend/src/
├── app/
│   ├── layout.tsx                      # Root shell: Header, Nav Sidebar, Status Banner
│   ├── page.tsx                        # Tab 1: Fleet Overview (P1 / P2 Status Grid)
│   ├── databases/
│   │   └── page.tsx                    # Tab 2: Database & Storage Capacity Gauges
│   ├── accounts/
│   │   └── page.tsx                    # Tab 3: Dynamic Account Manager & Sync
│   ├── email/
│   │   └── page.tsx                    # Tab 4: Email Operations Panel & Log Viewer
│   └── globals.css                     # Tailwind styling & badge utilities
├── components/
│   ├── Header.tsx                      # Platform title, environment badge, quick health pill
│   ├── DiagnosticBanner.tsx            # Alert banner for missing credentials / quota warnings
│   ├── FleetGrid.tsx                   # Service status cards across Vercel, Fly.io, Render, K3s
│   ├── CapacityGauge.tsx               # SVG / CSS progress gauges for 500MB / 512MB
│   ├── HotTableTable.tsx               # Sortable table breakdown of largest schema tables
│   ├── AccountTable.tsx                # Status badges (ACTIVE, DRAINING, DISCONNECTED, THROTTLED)
│   ├── EmailQuotaBar.tsx               # Daily quota consumption per email provider
│   └── EmailLogViewer.tsx              # Filterable, paginated table of sent emails
├── lib/
│   ├── api.ts                          # Fetch client targeting NEXT_PUBLIC_API_URL (port 3081)
│   └── types.ts                        # TypeScript interfaces matching backend Pydantic models
```

#### Detailed Module Requirements

1. **Header & Diagnostic Banner**:
   - Live banner at top of dashboard: queries `GET /api/accounts` and `GET /api/health/databases`.
   - If any product credential is missing or unconfigured, displays structured alert:
     > ⚠️ **Configuration Alert:** `zolexora-engage` has no active Firebase/Database binding in Infisical (`/zolexora-engage`). Defaulting to fallback sandbox mode.
   - Shows overall fleet status indicator: `🟢 Operational`, `🟡 Degraded`, or `🔴 Critical`.

2. **Fleet Overview Grid (`page.tsx`)**:
   - Visual grid displaying all microservices and deployments across:
     - **Production-1 (Serverless & PaaS Edge)**:
       - Vercel (Frontends: TMS, Admin, IronClub, Marketplace)
       - Cloudflare Pages / Workers (API Shield, Edge D1)
       - Fly.io & Render (Dockerized APIs: TMS Backend on 4030, IronClub Backend on 4060, Platform Admin on 3081)
     - **Production-2 (Sovereign K3s Cluster on Oracle ARM)**:
       - K3s Ingress Controller (Nginx)
       - K3s Background Worker Pods (Bulk email runner, Nightly backup runner)
   - Displays real-time status badges, response latency, and endpoint URLs.

3. **Database & Storage Capacity Gauges (`databases/page.tsx`)**:
   - Visual progress gauges for each Supabase project (Core, Commerce, Business, AI & ERP) against the **500MB free-tier limit**.
   - Visual progress gauge for MongoDB Atlas shared cluster against the **512MB free-tier limit**.
   - Color grading:
     - `< 70%`: Green (`#10B981`)
     - `70% - 89%`: Amber warning (`#F59E0B`)
     - `>= 90%`: Red critical (`#EF4444`) with **Autonomous Archive Recommended** tag.
   - Table size breakdown: displays estimated row counts and sizes for schema tables (`ims.products`, `marketplace.sellers`, `tms.shipments`, `textile_care.orders`, `clarity_fi.transactions`, `zolexora_ai.models`).

4. **Dynamic Account Manager (`accounts/page.tsx`)**:
   - Live table of all registered accounts (Firebase, Cloudflare, Database pools).
   - Columns: Provider, Alias, Project ID, Status (`ACTIVE`, `DRAINING`, `DISCONNECTED`, `QUOTA_THROTTLED`), Monthly/Daily Quota Used, Latency.
   - Action controls:
     - **"Re-sync from Infisical" button**: calls `POST /api/accounts/sync` to trigger non-destructive live discovery.
     - Status toggle dropdown to set account state for maintenance (`ACTIVE` / `DRAINING`).

5. **Email Operations Panel (`email/page.tsx`)**:
   - Top section: Provider daily limit progress bars:
     - Resend: `X / 100` emails today
     - Brevo: `Y / 300` emails today
     - SendGrid: `Z / 100` emails today
   - Middle section: Delivery health summary cards (Total Sent Today, Delivered Rate %, Bounce Rate %).
   - Bottom section: Permanent log viewer:
     - Queries `GET /api/email/logs`.
     - Filter inputs: Filter by Product, Recipient, Provider, and Status.
     - Searchable table displaying Timestamp, Product, To, Subject, Provider, Status, and Delivery details.

6. **Frontend Verification & Build Standards**:
   - TypeScript strict mode: zero `any` types for API contracts.
   - ESLint and Next.js compiler passes cleanly without hydration errors or dead imports:
     `pnpm --filter @zolexora/platform-admin-frontend build`.

---

### 2.4 Container Orchestration & Monorepo Alignment Specification

To satisfy R5 and align with monorepo standards documented in `14-monorepo-port-allocation-registry.md`:

#### Master Port Allocations (Adherence to Port Registry)
- **Frontend Port**: Host `3082` -> Container `3000` (Next.js).
- **Backend Port**: Host `3081` -> Container `8000` (FastAPI / Uvicorn).
- **PostgreSQL Port**: Host `5440` -> Container `5432` (`PLATFORM_ADMIN_POSTGRES_PORT`). Host port 5432 is strictly preserved for the developer's workstation OS.

#### Updated Compose Specification (`apps/platform-admin/compose.yaml`)

```yaml
version: '3.8'

services:
  platform-admin-postgres:
    image: postgres:16-alpine
    container_name: platform-admin-postgres
    environment:
      POSTGRES_USER: ${PLATFORM_ADMIN_POSTGRES_USER:-admin}
      POSTGRES_PASSWORD: ${PLATFORM_ADMIN_POSTGRES_PASSWORD:-adminpassword}
      POSTGRES_DB: ${PLATFORM_ADMIN_POSTGRES_DB:-platform_admin}
    volumes:
      - platform_admin_postgres_data:/var/lib/postgresql/data
    ports:
      - "${PLATFORM_ADMIN_POSTGRES_PORT:-5440}:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${PLATFORM_ADMIN_POSTGRES_USER:-admin} -d ${PLATFORM_ADMIN_POSTGRES_DB:-platform_admin}"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.1'
          memory: 128M

  platform-admin-backend:
    image: ${PLATFORM_ADMIN_BACKEND_IMAGE:-ghcr.io/zolexora/platform-admin-backend:latest}
    pull_policy: missing
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: platform-admin-backend
    ports:
      - "${PLATFORM_ADMIN_BACKEND_PORT:-3081}:8000"
    environment:
      - ENVIRONMENT=development
      - PORT=8000
      - DATABASE_URL=postgresql://${PLATFORM_ADMIN_POSTGRES_USER:-admin}:${PLATFORM_ADMIN_POSTGRES_PASSWORD:-adminpassword}@platform-admin-postgres:5432/${PLATFORM_ADMIN_POSTGRES_DB:-platform_admin}
    depends_on:
      platform-admin-postgres:
        condition: service_healthy
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.1'
          memory: 128M
    healthcheck:
      test: ["CMD-SHELL", "python3 -c 'import urllib.request; urllib.request.urlopen(\"http://localhost:8000/api/health\")'"]
      interval: 15s
      timeout: 5s
      retries: 5

  platform-admin-frontend:
    image: ${PLATFORM_ADMIN_FRONTEND_IMAGE:-ghcr.io/zolexora/platform-admin-frontend:latest}
    pull_policy: missing
    build:
      context: ../../
      dockerfile: apps/platform-admin/frontend/Dockerfile
    container_name: platform-admin-frontend
    ports:
      - "${PLATFORM_ADMIN_FRONTEND_PORT:-3082}:3000"
    environment:
      - NODE_ENV=development
      - NEXT_PUBLIC_API_URL=http://localhost:3081
    depends_on:
      platform-admin-backend:
        condition: service_healthy
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.1'
          memory: 128M
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3000 || exit 1"]
      interval: 20s
      timeout: 10s
      retries: 3

volumes:
  platform_admin_postgres_data:
```

#### Package Scripts Alignment in Root `package.json`

Add the following package scripts into root `package.json`:
```json
{
  "dev:admin": "pnpm --filter @zolexora/platform-admin-frontend dev",
  "dev:admin:frontend": "pnpm --filter @zolexora/platform-admin-frontend dev",
  "dev:admin:api": "uvicorn app.main:app --reload --host 127.0.0.1 --port 3081 --app-dir apps/platform-admin/backend",
  "build:admin": "pnpm --filter @zolexora/platform-admin-frontend build",
  "build:admin:frontend": "pnpm --filter @zolexora/platform-admin-frontend build",
  "lint:admin": "pnpm --filter @zolexora/platform-admin-frontend lint",
  "test:admin:api": "pytest apps/platform-admin/backend/tests -v",
  "docker:admin:start": "docker compose -f apps/platform-admin/compose.yaml up -d",
  "docker:admin:stop": "docker compose -f apps/platform-admin/compose.yaml down",
  "docker:admin:restart": "docker compose -f apps/platform-admin/compose.yaml restart",
  "docker:admin:build": "docker compose -f apps/platform-admin/compose.yaml build",
  "docker:admin:logs": "docker compose -f apps/platform-admin/compose.yaml logs -f",
  "docker:admin:status": "docker compose -f apps/platform-admin/compose.yaml ps"
}
```

---

## 3. Caveats

1. **Read-Only Scope**: This report is purely an architectural investigation and specification. No source files or compose configurations have been modified during this turn.
2. **React Version Overrides**: The root `package.json` specifies `"react": "19.1.0"` under pnpm overrides, whereas `apps/platform-admin/frontend/package.json` specifies `"react": "18.3.1"` and `"next": "14.2.3"`. During implementation, ensure `@types/react` and Next 14 compatibility flags (`--ignore-scripts` or matching versions) are maintained so Next.js 14 compiles cleanly without peer dependency conflicts.
3. **Infisical CLI Runtime Injection**: When Infisical is not logged in or machine tokens are not exported, startup scripts and backend initialization must gracefully fall back to reading `.env` files or using mocked sandbox credentials without blocking boot.
4. **Supavisor Port vs REST API**: The Supabase Python client (`supabase-py`) communicates via PostgREST HTTP/HTTPS endpoints, while Supavisor pooling on port 6543 applies to PostgreSQL connection strings (used by `asyncpg` / SQLAlchemy). The backend design accommodates both: `connections.py` configures PostgREST for REST operations and constructs `asyncpg` DSNs with `pool_port: 6543` for direct SQL queries and table size profiling.

---

## 4. Conclusion

1. **Architecture Is Fully Specified**: Requirements R1–R5 have been thoroughly analyzed and concrete blueprints have been defined for FastAPI endpoints, Pydantic schemas, non-blocking degradation patterns, multi-provider email failover, and telemetry profiling.
2. **Comprehensive Test Strategy Defined**: A modular Pytest suite is designed covering database mapping resolution, graceful degradation without secrets, quota throttling, email provider failover (Resend -> Brevo -> SendGrid), and capacity calculations against 500MB / 512MB limits.
3. **Frontend Dashboard Blueprinted**: Next.js 14 App Router layout, tabs, diagnostic banners, visual gauges, and TypeScript interfaces are specified to deliver the 4 core control panels on port `3082`.
4. **Container Orchestration & Port Allocations Aligned**: `apps/platform-admin/compose.yaml` is specified with prebuilt image tags, `pull_policy: missing`, container healthchecks, and strict adherence to the Monorepo Port Registry (`3081` backend, `3082` frontend, `5440` isolated postgres).

---

## 5. Verification Method

To independently verify this architectural specification and its subsequent implementation:

1. **Backend Test Suite Execution**:
   ```bash
   cd /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/apps/platform-admin/backend
   pytest tests/ -v
   ```
   *Expected outcome*: All unit and integration tests pass, verifying graceful degradation with missing secrets and multi-provider failover.

2. **Frontend Build & Typecheck**:
   ```bash
   cd /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform
   pnpm --filter @zolexora/platform-admin-frontend build
   pnpm --filter @zolexora/platform-admin-frontend lint
   ```
   *Expected outcome*: Zero TypeScript errors, zero ESLint warnings, successful production build generation in `.next/`.

3. **Container Compose Syntax & Schema Validation**:
   ```bash
   docker compose -f apps/platform-admin/compose.yaml config
   ```
   *Expected outcome*: Valid YAML output without syntax errors, port bindings correctly resolved to `3081`, `3082`, and `5440`.

4. **Port Registry Verification**:
   Inspect `docs/architecture/infrastructure/14-monorepo-port-allocation-registry.md` at line 29:
   Verify host ports `3081`, `3082`, and `5440` are strictly reserved for Platform Admin.

5. **Security Spot Check**:
   ```bash
   git status
   git diff
   ```
   *Expected outcome*: Zero secrets, unencrypted tokens, or credential files committed to git.
