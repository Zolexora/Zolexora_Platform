# Project: Zolexora TMS Docker & Infisical Integration

## Architecture
- **Monorepo Root**: `/workspaces/Zolexora_Platform`
- **Product Location**: `products/zolexora-tms`
- **Compose Definition**: `products/zolexora-tms/compose.yaml`
- **Secret Management**: Infisical CLI (`infisical run`) linked to workspace `188824cd-59ce-468f-b60f-f2da7aeefe63`, environment `dev`, path `/Zolexora_TMS`.
- **Services Architecture**:
  1. `tms-postgres`: PostgreSQL 16 on internal port 5432, host port `5448`.
  2. `tms-backend`: FastAPI/uvicorn application on port 4030, exposed on host `4030`, healthcheck on `/health`.
  3. `tms-web`: Next.js/Vite frontend on internal port 80.
  4. `tms-admin`: Next.js/Vite admin dashboard on internal port 80.
  5. `tms-nginx`: Reverse proxy on host port `3084`, proxying `/api/` -> `backend:4030`, `/` -> `tms-web:80`, `admin.localhost` -> `tms-admin:80`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Infisical CLI Installation | Install Infisical CLI in Linux environment via official APT repository or npm fallback | M1 | ORIGINAL_REQUEST §R1, Survey |
| 2 | Infisical Auth & Fallback Flow | Non-blocking authentication check, project linking, and dev fallback without hanging | M1 | ORIGINAL_REQUEST §R1, Survey |
| 3 | Start Docker Script Refactoring | Refactor `scripts/zolexora-tms/start-docker.sh` to target canonical compose file, remove Bitwarden/.env.docker, use `infisical run` | M2 | ORIGINAL_REQUEST §R2, Survey |
| 4 | Setup Start Script Alignment | Align `scripts/setup/start.sh` to support TMS non-interactively with `--projectId` and token auth | M2 | ORIGINAL_REQUEST §R2, Survey |
| 5 | Compose YAML Optimization | Add host port `4030:4030` to backend, add Nginx healthcheck dependencies (`tms-web`, `tms-admin`) | M2 | ORIGINAL_REQUEST §R3, Survey |
| 6 | Container Stack Execution | Build and run containers via refactored startup scripts using `infisical run` | M3 | ORIGINAL_REQUEST §R3, Survey |
| 7 | Service Health Checks & Ports | Validate all 5 containers are healthy and ports 5448, 4030, 3084 respond properly | M3 | ORIGINAL_REQUEST §R3, Acceptance Criteria |
| 8 | Secret Security & Git Hygiene | Ensure no decrypted secrets are written to disk or committed to git | M3 | ORIGINAL_REQUEST §Acceptance Criteria |
| 9 | Comprehensive E2E Verification | Validate 100% of E2E test suite (Tiers 1-4) and adversarial coverage hardening (Tier 5) | M4 | Project Pattern Dual Track |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Infisical CLI & Auth Setup | Install Infisical CLI, verify CLI in PATH, non-blocking auth check, workspace linkage | none | DONE (Infisical v0.44.2 in /usr/bin/infisical, verified clean) |
| M2 | Startup Scripts & Compose Alignment | Refactor `scripts/zolexora-tms/start-docker.sh`, align `scripts/setup/start.sh`, update `products/zolexora-tms/compose.yaml` | M1 | DONE (Scripts aligned, host port 4030 added, nginx dependencies healthy) |
| M3 | Container Orchestration & Health Validation | Build and launch container stack, verify container health checks and endpoints (5448, 4030, 3084), git hygiene | M2 | DONE (All 5 containers healthy, endpoints verified, DB initialized) |
| M4 | E2E Testing Pass & Hardening | Execute 100% E2E tests (Tiers 1-4) from E2E Testing Track and Tier 5 adversarial verification | M3, TEST_READY | DONE (147/147 tests passed 100%, Clean Victory Audit) |

## E2E Testing Track (Parallel)
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| T1 | E2E Test Suite Creation | Design opaque-box test infrastructure and tests covering Tiers 1-4 | none | DONE (78 tests, TEST_INFRA.md and TEST_READY.md published) |

## Interface Contracts
### Startup Scripts ↔ Docker Compose
- `scripts/zolexora-tms/start-docker.sh [start|stop|restart|status|logs|build]`
- Invocation: `infisical run --projectId=188824cd-59ce-468f-b60f-f2da7aeefe63 --env=dev --path=/Zolexora_TMS -- docker compose -f products/zolexora-tms/compose.yaml <action>`
- Fallback: If Infisical is not authenticated or unavailable, notify user and run `docker compose -f products/zolexora-tms/compose.yaml <action>` using existing environment without writing plaintext secret files to disk.

### Host Endpoints
- Postgres: `localhost:5449`
- Backend API Health: `http://localhost:4031/health` (HTTP 200, JSON status)
- Frontend Gateway (Nginx): `http://localhost:3090/` (HTTP 200)

## Code Layout
- Startup scripts:
  - `scripts/zolexora-tms/start-docker.sh`
  - `scripts/setup/start.sh`
  - `products/zolexora-tms/scripts/docker-start.sh`
- Compose definition:
  - `products/zolexora-tms/compose.yaml`
- Configuration & metadata:
  - `products/zolexora-tms/.infisical.json`
  - `config/envs/zolexora-tms/tms.env.example`
- Tests:
  - `tests/e2e/tms/`
