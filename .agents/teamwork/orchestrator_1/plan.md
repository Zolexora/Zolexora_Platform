# Orchestration Plan: Zolexora TMS Docker & Infisical Integration

## Objective
Start the Zolexora Transportation Management System (TMS) in Docker containers with secrets injected via Infisical, verify container health checks, and align startup scripts.

## Plan Breakdown

### Step 0: Survey & Discovery (Parallel Explorers)
- Explorer 1: Infisical CLI status, installation options, auth flows, workspace link in `products/zolexora-tms/.infisical.json`, environment requirements.
- Explorer 2: Existing startup scripts (`scripts/zolexora-tms/start-docker.sh`, `scripts/setup/start.sh`, `scripts/docker/*.sh`, compose configurations) and how `infisical run` should wrap docker compose.
- Explorer 3: Docker containers architecture (`products/zolexora-tms/compose.yaml`, Dockerfiles, ports `5448`, `4030`, `3084`, health check configurations, database migrations/seed, dependencies).

### Step 1: Synthesis & Decomposition
- Synthesize explorer findings into `PROJECT.md` (Feature Inventory, Architecture, Milestones, Interface Contracts, Code Layout).
- Spawn E2E Testing Orchestrator / Test Writer for E2E Test Suite (Tiers 1-4) covering all acceptance criteria.

### Step 2: Milestone Execution (Implementation Track)
- M1: Infisical CLI Setup and Authentication Flow.
- M2: Startup Script & Compose Configuration Alignment.
- M3: Container Orchestration & Health Validation (`postgres`, `backend`, `tms-web`, `tms-admin`, `nginx`).

### Step 3: E2E Verification & Audit Gate
- Run E2E tests against running stack.
- Review and Challenger checks.
- Mandatory Forensic Auditor check.

### Step 4: Completion & Handoff
- Generate final report and notify sentinel.
