# Worker Dispatch — Milestone 3: Monorepo Port Standard & Container Orchestration

**Agent Working Directory**: `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/worker_m3`
**Project Root**: `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform`
**Authoritative Request**: `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/ORIGINAL_REQUEST.md` (under `## Follow-up — 2026-10-20T18:25:06Z`)
**Project Scope**: `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/orchestrator_4/PROJECT.md`
**Port Registry Reference**: `docs/architecture/infrastructure/14-monorepo-port-allocation-registry.md`
**Architectural Blueprint**: `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/survey_explorer_3/handoff.md` (Section 2.4)

## Write Ownership
You exclusively own:
- `apps/platform-admin/compose.yaml`
- `package.json` (add platform-admin scripts in root `package.json`)
- `apps/platform-admin/Dockerfile` or backend/frontend Dockerfiles if adjustments needed

## Requirements to Implement (R5):
1. **Container Orchestration (`apps/platform-admin/compose.yaml`)**:
   - Align with `docs/architecture/infrastructure/14-monorepo-port-allocation-registry.md`:
     - Backend API: host port `3081` (`"${PLATFORM_ADMIN_BACKEND_PORT:-3081}:8000"`)
     - Frontend Dev: host port `3082` (`"${PLATFORM_ADMIN_FRONTEND_PORT:-3082}:3000"`)
     - Isolated PostgreSQL: host port `5440` (`"${PLATFORM_ADMIN_POSTGRES_PORT:-5440}:5432"`). Host port 5432 is strictly reserved for the developer workstation.
   - Add prebuilt image tags:
     - `image: ${PLATFORM_ADMIN_BACKEND_IMAGE:-ghcr.io/zolexora/platform-admin-backend:latest}`
     - `image: ${PLATFORM_ADMIN_FRONTEND_IMAGE:-ghcr.io/zolexora/platform-admin-frontend:latest}`
   - Set `pull_policy: missing` on both backend and frontend services.
   - Include dedicated `platform-admin-postgres` service (`postgres:16-alpine`) with healthcheck and volume persistence.
   - Include container healthchecks for all services.
   - Include resource reservations and limits (CPUs, memory).
2. **Root `package.json` Integration**:
   - Register standardized scripts for platform-admin:
     - `"dev:admin": "pnpm --filter @zolexora/platform-admin-frontend dev"`
     - `"dev:admin:frontend": "pnpm --filter @zolexora/platform-admin-frontend dev"`
     - `"dev:admin:api": "uvicorn app.main:app --reload --host 127.0.0.1 --port 3081 --app-dir apps/platform-admin/backend"`
     - `"build:admin": "pnpm --filter @zolexora/platform-admin-frontend build"`
     - `"build:admin:frontend": "pnpm --filter @zolexora/platform-admin-frontend build"`
     - `"lint:admin": "pnpm --filter @zolexora/platform-admin-frontend lint"`
     - `"test:admin:api": "pytest apps/platform-admin/backend/tests -v"`
     - `"docker:admin:start": "docker compose -f apps/platform-admin/compose.yaml up -d"`
     - `"docker:admin:stop": "docker compose -f apps/platform-admin/compose.yaml down"`
     - `"docker:admin:restart": "docker compose -f apps/platform-admin/compose.yaml restart"`
     - `"docker:admin:build": "docker compose -f apps/platform-admin/compose.yaml build"`
     - `"docker:admin:logs": "docker compose -f apps/platform-admin/compose.yaml logs -f"`
     - `"docker:admin:status": "docker compose -f apps/platform-admin/compose.yaml ps"`
3. **Verification**:
   - Run `docker compose -f apps/platform-admin/compose.yaml config` to ensure syntax and schema are 100% valid.
   - Ensure zero secrets or sensitive keys are committed.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Completion Criteria:
- `docker compose -f apps/platform-admin/compose.yaml config` passes cleanly.
- Root `package.json` scripts validated.
- Handoff report written to `/home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/worker_m3/handoff.md`.
- Notify orchestrator via `send_message`.


## 2026-10-20T22:14:40Z
[Message] timestamp=2026-10-20T22:14:40Z sender=484a39ec-460c-47ea-b91b-abd786450704 priority=MESSAGE_PRIORITY_HIGH
You are worker_m3.
Your working directory is /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/worker_m3.
Read your dispatch file at: /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/worker_m3/DISPATCH.md.
Read the authoritative request at: /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/ORIGINAL_REQUEST.md.
Read the port allocation registry at: docs/architecture/infrastructure/14-monorepo-port-allocation-registry.md.

Implement Milestone 3: Monorepo Port Standard & Container Orchestration (Requirement R5).
Update apps/platform-admin/compose.yaml and root package.json.
Verify with `docker compose -f apps/platform-admin/compose.yaml config`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write your handoff report to: /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/.agents/teamwork/worker_m3/handoff.md.
Notify me via send_message when complete.
