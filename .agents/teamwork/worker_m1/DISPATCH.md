# Worker Dispatch — Milestone 1: Platform Admin Backend Control Plane

**Agent Working Directory**: `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/worker_m1`
**Project Root**: `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform`
**Authoritative Request**: `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/ORIGINAL_REQUEST.md` (under `## Follow-up — 2026-10-20T18:25:06Z`)
**Project Scope**: `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/orchestrator_4/PROJECT.md`
**Architectural Findings**: 
- `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/survey_explorer_3/handoff.md`
- `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/survey_spec_miner_1/handoff.md`

## Write Ownership
You exclusively own:
`apps/platform-admin/backend/`
- `requirements.txt`
- `app/main.py`
- `app/schemas/` (`health.py`, `accounts.py`, `telemetry.py`, `email.py`, `storage.py`, `__init__.py`)
- `app/routers/` (`health.py`, `accounts.py`, `telemetry.py`, `email.py`, `storage.py`, `__init__.py`)
- `app/db/` (`config.py`, `connections.py`, `health.py`, `telemetry.py`, `__init__.py`)
- `app/services/` (`accounts.py`, `email.py`, `__init__.py`)
- `tests/` (`conftest.py`, `test_health.py`, `test_router.py`, `test_accounts.py`, `test_telemetry.py`, `test_email.py`, `test_storage.py`, `__init__.py`)

## Core Requirements to Implement:
1. **Dependencies (`requirements.txt`)**:
   Add `fastapi>=0.110.0`, `uvicorn[standard]>=0.29.0`, `pydantic>=2.7.0`, `asyncpg>=0.29.0`, `motor>=3.4.0`, `boto3>=1.34.0`, `httpx>=0.27.0`, `supabase>=2.4.0`, `pytest>=8.1.0`, `pytest-asyncio>=0.23.0`.
   Install dependencies in the environment (e.g. `pip install -r requirements.txt` or in a dedicated virtualenv).
2. **Database Connection & Telemetry Router (R1)**:
   - Supabase PostgreSQL connection management: routing to proper project (`core`, `commerce`, `business`, `ai_erp`) and schema namespace via Supavisor pooler port 6543 using `asyncpg`.
   - MongoDB Atlas client pooling: routing to mapped document databases (`db_ai`, `db_tms`, `db_engage`) via `motor`.
   - Cloudflare R2 presigned URL generator: secure object storage using `boto3` (`get_object`, `put_object`).
   - Real-time capacity monitoring and query telemetry: measuring DB size against free-tier thresholds (500MB PostgreSQL, 512MB MongoDB) and tracking hot table access statistics (`pg_stat_user_tables` / `$indexStats`).
   - Non-blocking graceful degradation: return HTTP 200 with clear degraded health payloads if credentials are empty rather than throwing unhandled exceptions.
3. **Dynamic Account Router & Infisical Secrets Sync (R2)**:
   - Runtime multi-account discovery and quota management across Firebase, Cloudflare, and DB clusters from Infisical workspace paths (`/shared/`, `/platform-admin/`) or local `.env` fallback.
   - Dynamic failover and quota throttling when accounts approach monthly/daily limits (90% threshold).
   - Missing credential diagnostics that log structured error events (`ROUTER_CREDENTIAL_MISSING`) without crashing services.
4. **Multi-Provider Email Router & Log Collector (R3)**:
   - Intelligent routing across multiple provider accounts (Resend, Brevo, SendGrid) tracking daily usage quotas (Resend: 100/day, Brevo: 300/day, SendGrid: 100/day) and failing over when accounts reach 90% capacity.
   - API endpoints (`POST /api/email/send`, `GET /api/email/quotas`, `GET /api/email/logs`).
   - Ingestion and permanent archiving of email delivery logs and events into MongoDB (`email_logs` collection).
5. **Comprehensive Pytest Suite (`tests/`)**:
   - Unit and integration tests verifying all endpoints, graceful degradation with missing secrets, failover logic, and capacity metrics.
   - Run `pytest tests/ -v` and ensure 100% of tests pass.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Completion Criteria:
- All source files and test files implemented cleanly.
- `pytest tests/ -v` passes with 100% success.
- Handoff report written to `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/worker_m1/handoff.md`.
- Notify orchestrator via `send_message`.


## 2026-10-20T20:57:28Z
Message received from parent 484a39ec-460c-47ea-b91b-abd786450704:
You are worker_m1.
Your working directory is /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/worker_m1.
Read your dispatch file at: /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/worker_m1/DISPATCH.md.
Read the authoritative request at: /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/ORIGINAL_REQUEST.md.
Read the project scope at: /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/orchestrator_4/PROJECT.md.
Read the survey reports at:
- /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/survey_explorer_3/handoff.md
- /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/survey_spec_miner_1/handoff.md

Implement Milestone 1: Platform Admin Backend Control Plane (Requirements R1, R2, R3) in apps/platform-admin/backend/.
Run the automated pytest test suite to verify all endpoints, graceful degradation, and email failover logic pass 100%.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write your handoff report to: /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/worker_m1/handoff.md.
Notify me via send_message when complete.
