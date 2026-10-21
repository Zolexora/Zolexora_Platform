# Orchestrator Dispatch

## Working Directory
`/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/orchestrator_4`

## Authoritative Request
See `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/ORIGINAL_REQUEST.md` (specifically under `## Follow-up — 2026-10-20T18:25:06Z`).

## Mission Summary
Build and implement the Zolexora Platform Admin control plane (`apps/platform-admin`), consisting of a high-performance FastAPI backend (multi-tenant database connection router, dynamic account router, email router, capacity telemetry) and a Next.js 14 fleet management dashboard.

Working directory: `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform`
Integrity mode: development

Reference documentation:
- Architecture & Infrastructure specifications: `docs/architecture/infrastructure/` (Docs 01–14 & CREDENTIAL_STORAGE_PLAN.md)
- Database schema migrations: `scripts/db/migrate-schemas.sql`
- Port allocation registry: `docs/architecture/infrastructure/14-monorepo-port-allocation-registry.md`
- Master database configuration template: `config/envs/platform-admin/.env.example`

## Requirements

### R1. Central Database Connection & Telemetry Router (FastAPI Backend)
Provide vendor-agnostic pooled database routing and health telemetry across all platform products:
- Supabase PostgreSQL connection management routing to the proper project (`core`, `commerce`, `business`, `ai_erp`) and schema namespace via Supavisor pooler port 6543.
- MongoDB Atlas client pooling routing to mapped document databases (`db_ai`, `db_tms`, `db_engage`).
- Cloudflare R2 presigned URL generator for secure object storage.
- Real-time capacity monitoring and query telemetry measuring database size against free-tier thresholds (500MB PostgreSQL, 512MB MongoDB) and tracking hot table access statistics.
- Graceful non-blocking degradation: return clear degraded health payloads if credentials are missing rather than throwing unhandled exceptions.

### R2. Dynamic Account Router & Infisical Secrets Sync
Implement runtime multi-account discovery and quota management:
- Live discovery of registered accounts across Firebase, Cloudflare, and database clusters from Infisical workspace paths (`/shared/`, `/platform-admin/`) without hardcoded account counts.
- Dynamic failover and quota throttling when accounts approach monthly/daily free limits (e.g., 90% threshold).
- Missing credential diagnostics that log structured error events and broadcast high-priority configuration alerts without crashing operational services.
- Safe fallback to local `.env` files when Infisical CLI authentication is absent.

### R3. Multi-Provider Email Router & Log Collector
Provide a unified transactional email sending gateway:
- Intelligent routing across multiple provider accounts (Resend, Brevo, SendGrid) tracking daily usage quotas and failing over when accounts reach capacity.
- API endpoints allowing platform products to dispatch transactional emails without holding individual provider credentials.
- Ingestion and permanent archiving of email delivery logs and events into MongoDB (`email_logs` collection).

### R4. Command Center Fleet Dashboard (Next.js Frontend)
Build the Next.js administration web interface on port 3082 connecting to the backend API on port 3081:
- Fleet Overview: real-time status grid of all registered accounts, databases, and microservices across Production-1 (Vercel, Fly.io, Render) and Production-2 (K3s).
- Database & Storage Capacity: visual progress gauges for 500MB/512MB limits, table size breakdowns, and hot data profiling.
- Dynamic Account Manager: status inspection (`ACTIVE`, `DRAINING`, `DISCONNECTED`), manual trigger to re-sync secrets, and missing credential diagnostic banners.
- Email Operations Panel: daily provider quota gauges, delivery health metrics, and searchable permanent delivery logs.

### R5. Monorepo Port Standard & Container Orchestration
Align the application with repository conventions:
- Strict port allocation: Frontend on `3082`, Backend on `3081`, isolated PostgreSQL offset on `5440`.
- Compose specification in `apps/platform-admin/compose.yaml` with prebuilt image tags (`ghcr.io/zolexora/platform-admin-*`), `pull_policy: missing`, and container healthchecks.
- Automated package scripts registered in root `package.json` for starting, stopping, building, and checking platform-admin.

## Acceptance Criteria

### Backend Verification
- [ ] Backend installs all dependencies (`fastapi`, `uvicorn`, `pydantic`, `asyncpg`, `motor`, `boto3`, `httpx`, `supabase`) and runs cleanly on port `3081`.
- [ ] `GET /api/health` returns HTTP 200 with service health status.
- [ ] `GET /api/health/databases` returns structured health latency and status for all configured database targets without throwing unhandled 500 errors when secrets are empty.
- [ ] `GET /api/accounts` and `GET /api/telemetry/capacity` respond with structured JSON schemas.
- [ ] Automated pytest or integration test suite passes verifying database routing resolution, error handling, and email failover logic.

### Frontend Verification
- [ ] Next.js application compiles without errors (`pnpm --filter @zolexora/platform-admin-frontend build`).
- [ ] ESLint and TypeScript checks pass with zero errors.
- [ ] Dashboard pages correctly query and render live data from the backend API endpoints.

### Integration & Security Verification
- [ ] `docker compose -f apps/platform-admin/compose.yaml config` passes syntax and schema validation.
- [ ] Ports strictly adhere to the monorepo registry (`3081` backend, `3082` frontend, `5440` postgres).
- [ ] Zero secrets, private tokens, or unencrypted `.env` credentials committed to git.


## 2026-10-20T19:00:31Z
[Message] timestamp=2026-10-20T19:00:31Z sender=56dee224-6057-43e7-963f-934d93764757 priority=MESSAGE_PRIORITY_HIGH content=You are the Project Orchestrator for the Zolexora Platform Admin control plane implementation.
Working directory: /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/orchestrator_4
Project root: /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform
Authoritative request: /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/ORIGINAL_REQUEST.md (under ## Follow-up — 2026-10-20T18:25:06Z)
Dispatch document: /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/orchestrator_4/DISPATCH.md

Mission: Build and implement the Zolexora Platform Admin control plane (`apps/platform-admin`), consisting of a high-performance FastAPI backend (multi-tenant database connection router, dynamic account router, email router, capacity telemetry) and a Next.js 14 fleet management dashboard.


## 2026-10-20T20:51:36Z
[Message] timestamp=2026-10-20T20:51:36Z sender=56dee224-6057-43e7-963f-934d93764757 priority=MESSAGE_PRIORITY_HIGH content=**Context**: Sentinel Liveness Check (Cron 2)
**Content**: Liveness check: progress.md has not been updated in 25 minutes. Please check the status of your dependent subagent (survey_explorer_2_rep), update your progress.md, and proceed with milestone transition.
