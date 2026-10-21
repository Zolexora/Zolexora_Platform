# Project: Zolexora Platform Admin Control Plane (`apps/platform-admin`)

## Architecture
- **Backend (FastAPI)**: Runs on port `3081`. Provides vendor-agnostic pooled database routing, telemetry monitoring against free-tier thresholds (500MB Postgres / 512MB Mongo), dynamic Infisical account discovery, and multi-provider transactional email dispatch (Resend, Brevo, SendGrid) with MongoDB log archiving.
- **Frontend (Next.js 14)**: Runs on port `3082`. Provides Fleet Overview (P1 / P2 status grid), Database & Storage Capacity visual gauges, Dynamic Account Manager with Infisical re-sync trigger, and Email Operations Panel with searchable delivery logs.
- **Database & Storage**: Supabase PostgreSQL (4 consolidated projects via Supavisor pooler port 6543), MongoDB Atlas M0 cluster (`db_ai`, `db_tms`, `db_engage`, `email_logs`), and Cloudflare R2 presigned URLs.
- **Monorepo Container Orchestration**: `apps/platform-admin/compose.yaml` adhering to `14-monorepo-port-allocation-registry.md` with Frontend on `3082`, Backend on `3081`, and isolated PostgreSQL container on host offset `5440`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Supabase 4-Project Routing | Multi-tenant routing to `core`, `commerce`, `business`, `ai_erp` | M1 | Survey |
| 2 | Supavisor Pooler Integration | Routes Postgres connections via port 6543 with asyncpg | M1 | Survey |
| 3 | Isolated Schema Qualification | Enforces schema search paths (`ims`, `marketplace`, `tms`, etc.) | M1 | Survey |
| 4 | MongoDB Atlas Pooling | Async client pooling via motor to mapped databases | M1 | Survey |
| 5 | Cloudflare R2 Presigned URLs | Secure S3 presigned URL generator via boto3 | M1 | Survey |
| 6 | Database Health Endpoint | `GET /api/health/databases` with latency & target status | M1 | Survey |
| 7 | Non-Blocking Graceful Degradation | HTTP 200 degraded payloads when secrets are empty | M1 | Survey |
| 8 | Capacity Telemetry & Gauges | Real-time DB capacity monitoring (500MB PG / 512MB Mongo) | M1 | Survey |
| 9 | Hot Data Profiling | Hot table access stats (`pg_stat_user_tables` / `$indexStats`) | M1 | Survey |
| 10 | 90% Capacity Archiver Logic | Identifies historical data to archive when DB reaches 90% | M1 | Survey |
| 11 | Hot Storage Pinning | Supports `[ 🔒 Pin to Hot Storage ]` table exclusions | M1 | Survey |
| 12 | Dynamic Account Discovery | Runtime discovery from Infisical `/shared/`, `/platform-admin/` | M1 | Survey |
| 13 | 90% Quota Failover Throttling | Transitions accounts to `QUOTA_THROTTLED` and fails over | M1 | Survey |
| 14 | Missing Credential Diagnostics | Structured JSON error events (`ROUTER_CREDENTIAL_MISSING`) | M1 | Survey |
| 15 | Local .env Fallback | Safe fallback when Infisical CLI authentication is absent | M1 | Survey |
| 16 | Multi-Provider Email Router | Central gateway pooling Resend, Brevo, SendGrid (150k/mo) | M1 | Survey |
| 17 | Intelligent Email Failover | Fails over to next provider when daily quota >= 90% | M1 | Survey |
| 18 | MongoDB Email Log Ingestion | Permanently archives email delivery records in `email_logs` | M1 | Survey |
| 19 | Pytest Automated Test Suite | Unit & integration tests for routing, failover, degradation | M1 | Survey |
| 20 | Fleet Overview Grid | Live status grid across P1 (Vercel/Fly/Render) and P2 (K3s) | M2 | Survey |
| 21 | Database Capacity Visualizer | Visual progress gauges (Green <70%, Amber 70-89%, Red >=90%) | M2 | Survey |
| 22 | Table Breakdown & Profiling | Visual breakdown of largest tables and row count estimates | M2 | Survey |
| 23 | Dynamic Account Manager UI | Status inspection, diagnostic banners, and re-sync trigger | M2 | Survey |
| 24 | Email Operations Panel | Daily provider quota gauges, delivery health, and search log | M2 | Survey |
| 25 | Next.js 14 Build Cleanliness | Typecheck and build without warnings or hydration errors | M2 | Survey |
| 26 | Strict Port Adherence | Frontend 3082, Backend 3081, Postgres Offset 5440 | M3 | Survey |
| 27 | Compose Specification | Prebuilt image tags, pull_policy: missing, healthchecks | M3 | Survey |
| 28 | Isolated Postgres Container | Dev Postgres container on port 5440 (host port 5432 reserved)| M3 | Survey |
| 29 | Root Package.json Scripts | Scripts for dev, build, lint, test, and docker operations | M3 | Survey |
| 30 | E2E & Gate Integrity Verification | Multi-agent review, adversarial challenge, forensic audit | M4 | Survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Technical Survey & Mapping | Specifications, existing codebase, and dependency exploration | none | DONE |
| M1 | Platform Admin Backend Control Plane | FastAPI: Database Router, Capacity Telemetry, Dynamic Accounts, Email Router, Pytest Suite (R1, R2, R3) | M0 | DONE |
| M2 | Command Center Fleet Dashboard | Next.js 14: Fleet Overview, Capacity Gauges, Account Manager, Email Operations Panel (R4) | M1 | DONE |
| M3 | Monorepo Port Standard & Container Orchestration | Compose specification, isolated Postgres on 5440, root package.json scripts (R5) | M2 | DONE |
| M4 | Comprehensive Verification & Gate Review | Independent Reviewers, Challengers, and Forensic Integrity Auditor gate | M3 | DONE |

## Interface Contracts

### Backend API ↔ Frontend Dashboard
- Base URL: `http://localhost:3081`
- `GET /api/health` -> `{ status: "ok" | "degraded", service: "platform-admin-backend", environment: str, timestamp: str }`
- `GET /api/health/databases` -> `{ overall_status: "healthy" | "degraded" | "unhealthy", targets: { [target: str]: { target: str, status: "healthy" | "degraded" | "unconfigured", latency_ms: int, details: Optional[str], error: Optional[str] } } }` (Returns HTTP 200 even when secrets are missing)
- `GET /api/accounts` -> `{ accounts: [DiscoveredAccount], total_count: int, active_count: int, throttled_count: int, alerts: [AccountDiagnosticAlert] }`
- `POST /api/accounts/sync` -> `{ status: "success" | "partial", discovered_count: int, timestamp: str }`
- `PUT /api/accounts/{account_id}/status` -> `{ id: str, status: "ACTIVE" | "DRAINING" | "DISCONNECTED" | "QUOTA_THROTTLED" }`
- `GET /api/telemetry/capacity` -> `{ databases: [StorageQuotaMetric], overall_threshold_alert: bool, hot_tables: [HotTableMetric], timestamp: str }`
- `POST /api/email/send` -> `{ success: bool, message_id: str, provider_used: "resend" | "brevo" | "sendgrid", account_used: str, status: "queued" | "sent" | "failed" }`
- `GET /api/email/quotas` -> `{ providers: [ProviderQuotaMetric], timestamp: str }`
- `GET /api/email/logs` -> `{ logs: [EmailLogRecord], total: int, page: int, limit: int }`
- `POST /api/storage/presigned-url` -> `{ url: str, bucket: str, file_key: str, expires_in_seconds: int }`

## Code Layout
- Backend: `apps/platform-admin/backend/`
  - `app/main.py`: FastAPI entrypoint and router registration
  - `app/schemas/`: Pydantic models for health, accounts, telemetry, email, storage
  - `app/routers/`: Health, accounts, telemetry, email, storage endpoints
  - `app/db/`: Config, connections (Supabase, Mongo, R2), health probes, telemetry calculators
  - `app/services/`: Infisical account sync, email router & failover, archival logic
  - `tests/`: Pytest unit and integration test suite (`conftest.py`, `test_*.py`)
  - `requirements.txt`: Python package dependencies
  - `Dockerfile`: Container image build
- Frontend: `apps/platform-admin/frontend/`
  - `src/app/`: Next.js 14 App Router pages (`layout.tsx`, `page.tsx`, `databases/page.tsx`, `accounts/page.tsx`, `email/page.tsx`)
  - `src/components/`: Header, DiagnosticBanner, FleetGrid, CapacityGauge, HotTableTable, AccountTable, EmailQuotaBar, EmailLogViewer
  - `src/lib/`: `api.ts`, `types.ts`
  - `package.json`: Frontend package manifest
- Container & Root:
  - `apps/platform-admin/compose.yaml`: Docker compose with ports `3081`, `3082`, `5440`
  - `package.json`: Root scripts for `platform-admin`
