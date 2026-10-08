# Copilot instructions for FleetRelay

## Workspace layout

This repo is a pnpm monorepo with a few small apps and shared libraries:

- `artifacts/api-server`: Express API for health checks and WhatsApp send/webhook endpoints.
- `artifacts/client/web`: Vite + React main dispatcher UI for importing duty sheets and sending WhatsApp messages.
- `lib/*`: shared workspace packages such as generated API clients (`api-zod`, `api-client-react`), API spec, and Drizzle/Postgres DB schema.
- `supabase/`: Supabase configuration and DB artifacts.
- `scripts/`: shell helpers that load secrets from Bitwarden and `.env`.
- `docker/`: container build files used by the Docker Compose stack.

The main product flow is: import an Excel/CSV duty sheet in the dispatcher UI, validate the required columns, personalize a WhatsApp message per driver, send via the Express API, and poll delivery status back to the UI.

## Build, typecheck, and validation commands

Use pnpm; the repo intentionally rejects npm/yarn in the root `preinstall` script.

Common commands from the repo root:

- Install dependencies:
  - `pnpm install`
- Full project build:
  - `pnpm build`
- Root typecheck:
  - `pnpm typecheck`
- Run typecheck for one package:
  - `pnpm --filter @workspace/api-server typecheck`
  - `pnpm --filter @workspace/client-web typecheck`
  - `pnpm --filter @workspace/db typecheck` (if a package has a typecheck script; `@workspace/db` does not, so prefer `pnpm --dir lib/db exec tsc --noEmit` only if needed)
- Build one app/package:
  - `pnpm --filter @workspace/api-server build`
  - `pnpm --filter @workspace/client-web build`

There are no dedicated test or lint scripts in this repo (`test`, `lint`, `eslint`, `vitest`, `jest`, etc. are not configured). The effective validation path is TypeScript checks and app builds, not a separate unit-test suite.

Runtime/dev commands:

- Start the full dockerized stack:
  - `export BW_SESSION="$(bw unlock --raw)"`
  - `./scripts/RunProject.sh` (repo scripts load Bitwarden-backed env secrets via `dotenvx`)
  - or: `docker compose up --build`
- Local frontend dev:
  - `export BW_SESSION="$(bw unlock --raw)"`
  - `./scripts/RunWebDev.sh`
- Local API server dev:
  - `pnpm --filter @workspace/api-server dev`

## High-level architecture

The code is split intentionally around a few responsibilities:

- `artifacts/api-server` is the backend boundary. It creates the Express app, wires routing, logs with `pino`, applies `cors` and JSON parsing, and serves `/api/*` routes. The WhatsApp functionality is owned here, including signature verification, send calls to Meta's Graph API, webhook processing, and in-memory status tracking for message delivery states.
- `artifacts/client/web` is the user-facing business app. Its `src/app` folder owns providers and routing, `src/features/auth` owns Supabase access gating, and `src/features/dispatch` owns spreadsheet import, queue management, personalized messages, and WhatsApp status polling.
- The canonical product UI is the client app in `artifacts/client/web`.
- `lib/api-spec` + generated client packages define the API contract used by both server and clients. The generated `@workspace/api-zod` and `@workspace/api-client-react` packages should be treated as contract artifacts: when the API shape changes, update the spec/generation step rather than hand-editing generated outputs.
- `lib/db` is the database layer. It is set up for Drizzle + PostgreSQL schema work and is intentionally minimal today (`src/schema/index.ts` is a placeholder export file).
- `supabase/` and environment variables power the app's external services. Secrets are expected to come from Bitwarden and `.env`, not from committed source files.

## Key conventions and repo-specific patterns

- Use pnpm workspaces and `@workspace/*` package names; do not switch to npm or yarn in this repo.
- The repo uses ESM (`"type": "module"`) across packages.
- Secret material is intentionally externalized. The README warns that WhatsApp access tokens must never be placed in frontend code, Excel files, or GitHub; the repo expects Bitwarden + `dotenvx` to supply runtime creds.
- Duty-sheet imports are strict: required columns are matched case-insensitively and punctuation is normalized. Rows with missing/invalid values are rejected before sending. Preserve that validation behavior when editing the importer.
- When modifying the WhatsApp API contract or server/client interfaces, update the generated client code intentionally; keep the server and client validation layers aligned.
- The project depends on Docker and Vite for local runtime, but the repo does not include a test runner or lint configuration; prefer compile-time correctness and package builds as the validation baseline.
- `pnpm-workspace.yaml` contains a package minimum release age guard and platform overrides; avoid introducing install workflows that bypass the workspace's secure package policy.

## Working in this repo

Prefer editing the smallest relevant workspace package and keep the frontend/backend contract in sync. The app is structured as a monorepo, not as a single app, so avoid assuming the frontend and API are a single package or a single build target.



# Copilot instructions for Swarm Factory

Purpose
- Short, repository-specific guidance for Copilot-powered sessions. Focus on builds, tests, linting, architecture, and non-obvious conventions.

1) Build, test, and lint commands

Backend (Python/FastAPI)
- Install deps: pip install -r requirements.txt
- Run dev server: cd backend && uvicorn api.server:app --reload
- Start Celery worker: cd backend && celery -A celery_app worker --loglevel=info
- Run full tests: pytest tests/ --cov=backend --cov-report=term-missing -v
- Run single test file: cd backend && pytest tests/test_file.py -q
- Run single test function: cd backend && pytest tests/test_file.py::test_name -q
- Lint: ruff check backend/
- Note: CI sets stub AZURE_* envs for unit tests; Nightly workflow runs Redis service for integration tests.

Frontend (React + Vite + TS)
- Install: cd frontend && npm ci
- Dev: cd frontend && npm run dev
- Build: cd frontend && npm run build
- Type-check: cd frontend && npm run typecheck
- Lint: cd frontend && npm run lint
- Single-file tests: not included; use typecheck/lint for code validation.

Docker
- Build backend image: docker build -f infra/Dockerfile -t swarm-factory-backend:latest .
- Run compose (dev): docker compose -f docker.yaml up --build -d
- Redis (local): docker run -d -p 6379:6379 --name redis redis:alpine

CI notes (GitHub Actions)
- CI job installs pip deps and runs `ruff check backend/` (continue-on-error) then `pytest tests/ --cov=backend ...` with AZURE_* stubs.
- Nightly workflow runs backend tests with Redis service and enforces `--cov-fail-under=70`.
- Frontend CI uses Node 20 and `npm ci`, `npm run typecheck`, `npm run lint`.

2) High-level architecture (big picture)
- Multi-agent orchestration: 7 specialized AI agents (Planner, Architect, Coder, Tester, Reviewer, Mediator, DevOps) — see README for the pipeline diagram.
- Backend: FastAPI app (backend/), Celery workers for async jobs, Redis for queuing/state, Python 3.11 pinned due to pydantic-core build constraints.
- Frontend: React + Vite + TypeScript in frontend/; Vite dev server proxies /api and /ws to backend when VITE_* vars are empty.
- Infra & Deploy: infra/ contains Dockerfile and Azure Bicep; scripts/ contains setup_azure.sh and deploy.sh to provision Azure OpenAI, Azure AI Search, ACR, and Container Apps.
- CI/CD: GitHub Actions workflows in .github/workflows handle linting, tests, and deployments.

3) Key conventions and repository-specific patterns
- Python version: target 3.11 (requirements and CI expect 3.11). Pydantic-core is sensitive to newer Python versions.
- Env setup: copy .env.example -> .env and set AZURE_OPENAI_* and other AZURE_* keys. Frontend uses VITE_* vars — leave empty in local/dev so Vite proxies to localhost:8000.
- Tests: unit tests live under backend/tests/ (nightly) and lightweight smoke tests at repo root tests/ for quick CI checks.
- CI stubbing: CI injects stub AZURE_* envs for unit tests to avoid live Azure dependency; do not rely on real Azure keys in CI.
- Linting: ruff is used for Python; frontend uses eslint + tsc. CI allows ruff failures to surface without failing the job (continue-on-error in CI primary workflow).
- Docker networking: recommended network name is `swarm-net` (used in README examples).
- Coverage gate: nightly tests enforce a coverage floor (70%). Keep tests focused on core backend logic that does not require live Azure calls.
- Preserve architecture: changes should respect the multi-agent pipeline and Azure-first design — avoid swapping provider-specific components.

Where to look for more details
- ARCHITECTURE.md (in repo) — in-depth component diagrams and data schemas.
- .github/workflows/ — CI details, env stubbing, and nightly test orchestration.
- infra/ and scripts/ — deployment and provisioning details for Azure resources.

If an existing .github/copilot-instructions.md exists, merge these points with local/team-specific notes (do not overwrite preferences).

---

Generated by the repository assistant to help future Copilot sessions. Update this file when adding CI steps, new test suites, or changing deployment targets.
