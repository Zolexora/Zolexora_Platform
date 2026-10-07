# Phase 1.5 directory reorganization audit

Date: 2026-07-14. Starting branch/commit: `main` at `87d751c455c6bd3dfd75d154389fb64745839e12`. The dirty tree contained uncommitted Phase 1 work and a pre-existing deletion of `docs/auth-token-storage-risk.md`; both were preserved.

## Outcome

**PASS WITH BLOCKERS.** All path, package-identity, workspace, backend, Compose, and symlink gates pass. The pre-existing Mahila web zero-test failure remains visible and causes `pnpm test` and `pnpm verify` to exit 1.

## Applied mapping

| Old root | Canonical root |
| --- | --- |
| Zolexora buyer web | `apps/storefronts/zolexora-shop/web` |
| Mahila client/server | `apps/storefronts/mahila-madel/web` and `legacy-server` |
| Zolexora seller/admin web | `apps/portals/seller/web` and `apps/portals/marketplace-admin/web` |
| Zolexora mobile apps | `apps/mobile/buyer` and `apps/mobile/seller` |
| FastAPI | `services/marketplace-api` |
| Supabase assets | `services/marketplace-api/infrastructure/supabase` |
| Frontend Dockerfile | `infrastructure/docker/Dockerfile.frontend` |
| Legacy Nginx/Compose | `infrastructure/nginx/` and `infrastructure/docker/` |

The Mahila wrapper manifest was retired after its useful commands existed at root. No nested npm/yarn lockfile is repository-owned; `pnpm-lock.yaml` is canonical.

## Workspace and tasks

The guard verifies exactly nine packages: both storefronts, Mahila legacy server, seller/admin portals, buyer/seller mobile, shared API, and shared config. `pnpm build` executes seven real build tasks (three Next, one CRA, two Expo, shared API); Turbo also recognizes the two intentionally non-build packages. Type-check runs 6/6 and lint runs 2/2 plus backend Ruff.

## Command evidence

| Command | Exit | Evidence |
| --- | ---: | --- |
| `pnpm install --frozen-lockfile` | 0 | all workspace projects, lock current |
| `pnpm verify:workspace` | 0 | exactly nine required packages |
| `pnpm build` | 0 | real web/mobile/shared tasks executed |
| `pnpm type-check` | 0 | 6/6 tasks |
| `pnpm lint` | 0 | 2/2 tasks and Ruff; two existing image warnings |
| `pnpm test` | 1 | buyer mobile 5/5; Mahila zero tests |
| `pnpm verify` | 1 | stops honestly at same Mahila failure |
| backend compile / Ruff / pytest | 0 | 59 passed, 368 Python 3.14 deprecation warnings |
| `docker compose config --quiet` | 0 | all canonical paths resolve |
| `git diff --check` | 0 | no whitespace errors |

## Assets and validation

Five broken historical logo symlinks were removed. Real `Zolexora_logo.png` files now exist in all three Next public directories, `Zolexora_fav.png` is in the Zolexora storefront, mobile auth continues to use each app’s `assets/icon.png`, and the obsolete shared `apps/public/` directory is gone. No broken source symlink remains.

Active configuration contains no stale historical application or FastAPI path. Historical Phase 0/1 audits and the supplied directory blueprint intentionally retain old paths as evidence. Provider-local comments inside transitional Supabase configuration remain intentional.

## Remaining blockers

- P0: storefront isolation/data/payment ownership and client-trusted payment behavior.
- P1: Mahila missing tests and dependency vulnerabilities; secure sessions; full ARM64 runtime validation; OCI implementation.
- P2: legacy deployment guidance and existing lint/deprecation warnings.

## Phase 2 recommendation

Add trusted host-to-storefront resolution and shared storefront contracts with fail-closed and isolation tests. Do not combine this with database migration or payment routing.
