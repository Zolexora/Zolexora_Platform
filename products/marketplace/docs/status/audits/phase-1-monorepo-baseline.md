# Phase 1 monorepo baseline audit

## Verdict

**PASS WITH BLOCKERS.** Package discovery, lock ownership, root checks, CI paths, and Docker paths are deterministic. All buildable applications build and all TypeScript packages type-check. The root test command truthfully fails because Mahila has no tests.

## Starting state

- Branch `main`; commit `87d751c455c6bd3dfd75d154389fb64745839e12`.
- Pre-existing untracked paths: `AGENTS.md`, `project/`.
- Workspace discovered only root, `@zolexora/shared-api`, and `@zolexora/shared-config`.
- Lockfile/Docker/Compose/CI used obsolete flat `apps/*` paths.
- Three nested Mahila npm lockfiles created ambiguous ownership.

## Workspace inventory

| Before | After canonical path/package |
|---|---|
| not discovered | `apps/ZolexoraShop/web-app/buyer` — `web-buyer` |
| not discovered | `apps/ZolexoraShop/web-app/seller` — `web-seller` |
| not discovered | `apps/ZolexoraShop/web-app/adminpanal` — `web-admin` |
| not discovered | `apps/ZolexoraShop/mobile-app/buyer` — `mobile-buyer` |
| not discovered | `apps/ZolexoraShop/mobile-app/seller` — `mobile-seller` |
| independent npm client | `apps/MahilaMadel/web-app/client` — `web-mahila-madel` |
| independent npm server | `apps/MahilaMadel/web-app/server` — `legacy-mahila-server` |
| discovered | `packages/shared-api` — `@zolexora/shared-api` |
| discovered | `packages/shared-config` — `@zolexora/shared-config` |

The `apps/MahilaMadel/web-app/package.json` wrapper is intentionally not a workspace package or third application. Root scripts own useful client/server orchestration.

| Package | Framework/runtime | Scripts (build/type/lint/test) | Dev port | pnpm/Turbo/CI | Compose |
|---|---|---|---:|---|---|
| `web-buyer` | Next.js 15 / Node | yes / yes / yes / no | 3000 | discovered / real tasks / root checks | service |
| `web-seller` | Next.js 15 / Node | yes / yes / no / no | 3001 | discovered / real tasks / root checks | service |
| `web-admin` | Next.js 15 / Node | yes / yes / no / no | 3002 | discovered / real tasks / root checks | service |
| `mobile-buyer` | Expo 54 / Node | Android export / yes / no / Vitest | 8081 | discovered / real tasks / root checks | service |
| `mobile-seller` | Expo 54 / Node | Android export / yes / no / no | 8082 | discovered / real tasks / root checks | service |
| `web-mahila-madel` | CRA React 18 / Node | yes / n/a JS / build-integrated / zero-test command | 3000 | discovered / real tasks / root checks | not configured |
| `legacy-mahila-server` | Express 4 / Node | n/a / n/a JS / syntax / no | 5000 | discovered / syntax task / root checks | not configured; transitional |
| `@zolexora/shared-api` | TypeScript library | validation / yes / no / no | n/a | discovered / real tasks / root checks | copied into frontend image |
| `@zolexora/shared-config` | shared configuration | n/a | n/a | discovered / no fabricated tasks / inventory guard | copied into frontend image |

All nine use pnpm 9 and the root lockfile. CI invokes root checks rather than duplicating package paths. Docker Compose intentionally contains only the existing Zolexora services plus FastAPI/data dependencies; absence of Mahila services does not present Express as the final backend.

## Lock and task ownership

The root `pnpm-lock.yaml` was regenerated once and frozen installation passes. Client, server, and wrapper `package-lock.json` files were removed after both active Mahila packages appeared in the root lockfile. ADR 0005 records pnpm/root-lock ownership. `scripts/verify-workspace.mjs` uses Node standard library plus pnpm’s inventory and fails on missing, duplicate, unexpected, misplaced, task-deficient, or obsolete packages.

Turbo now declares build, type-check, lint, test, and persistent uncached dev tasks. Build outputs cover Next `.next`, CRA `build`, and Expo `dist`. Tests are uncached. Root commands run the guard before Turbo.

## Files changed

- Workspace/task ownership: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json`, `scripts/verify-workspace.mjs`, shared API manifest.
- Mahila ownership: wrapper/client/server manifests; three nested npm lockfiles removed.
- CI/containers/docs paths: `.github/workflows/ci.yml`, `Dockerfile.frontend`, `docker-compose.yml`, `.dockerignore`, root `README.md`.
- Mechanical build repair: buyer/seller mobile auth screens reference their existing `assets/icon.png`.
- Durable/status evidence: ADR 0005, architecture/memory/runbook/indexes/status/gaps/actions/tests, and this audit.

## Command evidence

| Area | Result |
|---|---|
| frozen install / workspace guard / recursive list | pass; root plus nine packages |
| root build | pass, 7/7 actual tasks |
| root type-check | pass, 6/6 actual tasks |
| root lint | pass, two configured JS checks plus backend Ruff; existing warnings remain |
| root test | continues through both configured suites: buyer mobile 5/5 pass; exit 1 for Mahila zero tests; no false-green flag added |
| buyer mobile test | 5/5 pass |
| backend | compile pass; Ruff pass; 59/59 pytest pass |
| Docker Compose config | pass |
| complete root verify | exit 1 at Mahila zero-test result after guard/type/lint pass |

Direct proof: buyer, seller, and admin Next builds pass; buyer and seller Android Expo exports pass; Mahila CRA production build passes; shared API validation passes. Both Expo builds initially exposed imports of nonexistent `Zolexora_logo.png`; the two auth screens now use each package’s existing `assets/icon.png`.

## CI and Docker

CI pins pnpm 9.0.0, uses frozen installation, runs the workspace guard, build, type-check, configured lint, existing frontend tests, and backend compile/Ruff/pytest. No deployment was added. The old frontend test path is gone.

Dockerfile manifest copies and Compose env-file paths now reference actual directories. Frontend images use the root lockfile. `/api/health` remains the backend health check. Mahila Express is not represented as the final backend. ARM64 structural checks pass for both Dockerfiles. A native full Compose build reached corrected manifest copies, the frozen workspace install, and base-image downloads, then was stopped with exit 130 after roughly ten minutes of slow network downloads; it did not reach a code-build verdict. Root `.dockerignore` now excludes local virtual environments and generated build/coverage output. ARM64 runtime remains Phase 6 work.

## Remaining blockers

- P0: storefront/data/payment ownership and payment security gaps from Phase 0 remain unchanged.
- P1: Mahila client/server lack tests; legacy dependency vulnerabilities and peer/deprecation warnings remain; only two JavaScript packages have dedicated lint tasks; full ARM64 runtime is unverified.
- P2: legacy deployment-provider/domain prose still needs OCI-phase cleanup; Next builds report existing lint warnings.

Known auth/payment findings remain unchanged: localStorage bearer tokens, OTP logging, global Razorpay/UPI credentials, browser-selected payment method, no gateway abstraction/webhook/refund/reconciliation/robust idempotency, and Mahila client-trusted totals.

## Acceptance checklist

- [x] nine required packages discovered with unique names
- [x] one canonical root pnpm lockfile; frozen install passes
- [x] false-green guard passes and rejects stale paths
- [x] root build/type-check/lint execute real packages
- [x] five Zolexora applications and Mahila production build execute
- [x] backend compile/Ruff/59 tests pass
- [x] CI and Docker contain no active obsolete app paths
- [x] `docker compose config` passes
- [ ] root tests pass (blocked by zero Mahila tests)
- [ ] full ARM64 image runtime verified (deferred to OCI phase)

## Phase 2 recommendation

Implement trusted storefront/domain resolution and shared storefront contracts with allowlisted host tests and isolation tests. Do not add database migrations, gateway code, auth redesign, or OCI resources in Phase 2.
