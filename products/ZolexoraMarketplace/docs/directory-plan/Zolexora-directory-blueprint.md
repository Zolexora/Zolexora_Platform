# Zolexora repository directory blueprint

## Purpose

This blueprint defines the physical repository reorganization that should occur between Phase 1 and Phase 2. It is based on a fresh extraction and scan of the uploaded `ZolexoraMarketplace-main.zip`, supplemented only by the files explicitly reported in the Phase 1 completion report.

It does not claim that the uploaded archive contains the later Phase 1 changes. Apply the reorganization to the current local Git worktree that contains Phase 1, not to the uploaded snapshot.

## Scan evidence

- Fresh archive extraction was used as the source, not the previously modified working copy.
- 312 meaningful archive filesystem entries were inventoried after excluding generated dependency/build/cache directories: 307 regular files plus five broken logo symlinks.
- The upload contains ten nested package manifests: seven active application packages, the Mahila wrapper, and two shared packages.
- Phase 1 reportedly makes exactly nine nested packages workspace members; the Mahila wrapper is intentionally outside the workspace.
- The original upload contains three npm lockfiles under Mahila; Phase 1 reportedly removed all three.
- Five uploaded `Zolexora_logo.png` entries are broken relative symlinks:
  - Two under the mobile `assets/` directories.
  - Three under the Next.js `public/` directories.
- The uploaded archive contains only `docs/auth-token-storage-risk.md`; the larger `docs` and `docs/status` corpus exists only in the newer Phase 1 worktree/report.
- The uploaded archive does not contain the reported `AGENTS.md`, `scripts/verify-workspace.mjs`, ADR 0005, or Phase 1 status audit.

## Decision

Create a capability-oriented layout:

```text
apps/
├── storefronts/
│   ├── zolexora-shop/
│   │   └── web/
│   └── mahila-madel/
│       ├── web/
│       └── legacy-server/       # temporary only
├── portals/
│   ├── seller/
│   │   └── web/
│   └── marketplace-admin/
│       └── web/
└── mobile/
    ├── buyer/
    └── seller/

services/
└── marketplace-api/             # shared FastAPI backend

packages/
├── shared-api/
└── shared-config/

infrastructure/
├── docker/
└── nginx/

project/
├── docs/
└── status/

scripts/
```

## Why Mahila has a temporary `legacy-server`

The Mahila Express/Mongoose server is not a second target backend. It remains temporarily because the current Mahila React client still calls its authentication, product, cart, wishlist, order, user, and admin routes.

Its location under the Mahila storefront makes its ownership and temporary nature explicit:

```text
apps/storefronts/mahila-madel/
├── web/                   # customer application retained
└── legacy-server/         # migration source; never the final production API
```

It is deleted only after Mahila reaches feature parity on `services/marketplace-api/`. It must not be deployed as a permanent independent backend.

## Canonical package roots after the move

| Target package root | Recommended package name | Lifecycle |
| --- | --- | --- |
| `apps/storefronts/zolexora-shop/web` | `@zolexora/storefront-zolexora-shop` | Permanent |
| `apps/storefronts/mahila-madel/web` | `@zolexora/storefront-mahila-madel` | Permanent |
| `apps/storefronts/mahila-madel/legacy-server` | `@zolexora/mahila-legacy-server` | Temporary |
| `apps/portals/seller/web` | `@zolexora/seller-portal` | Permanent |
| `apps/portals/marketplace-admin/web` | `@zolexora/marketplace-admin` | Permanent |
| `apps/mobile/buyer` | `@zolexora/buyer-mobile` | Permanent |
| `apps/mobile/seller` | `@zolexora/seller-mobile` | Permanent |
| `packages/shared-api` | `@zolexora/shared-api` | Permanent |
| `packages/shared-config` | `@zolexora/shared-config` | Permanent |

This preserves exactly nine workspace packages.

Recommended workspace patterns:

```yaml
packages:
  - "apps/storefronts/*/web"
  - "apps/storefronts/*/legacy-server"
  - "apps/portals/*/web"
  - "apps/mobile/*"
  - "packages/*"
```

The Mahila container directory itself must not have a package manifest. Its old wrapper scripts belong in the root package scripts.

## Top-level old-to-new directory mapping

| Uploaded path | Target path | Action |
| --- | --- | --- |
| `apps/ZolexoraShop/web-app/buyer/` | `apps/storefronts/zolexora-shop/web/` | Move |
| `apps/MahilaMadel/web-app/client/` | `apps/storefronts/mahila-madel/web/` | Move |
| `apps/MahilaMadel/web-app/server/` | `apps/storefronts/mahila-madel/legacy-server/` | Move temporarily |
| `apps/ZolexoraShop/web-app/seller/` | `apps/portals/seller/web/` | Move |
| `apps/ZolexoraShop/web-app/adminpanal/` | `apps/portals/marketplace-admin/web/` | Move and correct spelling |
| `apps/ZolexoraShop/mobile-app/buyer/` | `apps/mobile/buyer/` | Move |
| `apps/ZolexoraShop/mobile-app/seller/` | `apps/mobile/seller/` | Move |
| `backend/` | `services/marketplace-api/` | Move without changing internal Python layout |
| `supabase/` | `services/marketplace-api/infrastructure/supabase/` | Move; transitional until Oracle migration |
| `docs/` | `docs/` | Move/merge |
| `DEPLOYMENT.md` | `docs/runbooks/legacy-deployment.md` | Move and mark superseded |
| `Dockerfile.frontend` | `infrastructure/docker/Dockerfile.frontend` | Move |
| `backend/docker-compose.yml` | `infrastructure/docker/legacy-api-scale.compose.yml` | Move and label transitional |
| `backend/nginx-docker.conf` | `infrastructure/nginx/legacy-api-docker.conf` | Move and label transitional |
| `backend/nginx.conf` | `infrastructure/nginx/legacy-api-host.conf` | Move and label transitional |

## Mahila wrapper handling

| Uploaded file | Target treatment |
| --- | --- |
| `apps/MahilaMadel/web-app/package.json` | Retire after copying useful commands to the root `package.json` |
| `apps/MahilaMadel/web-app/package-lock.json` | Remove; already reported removed in Phase 1 |
| `apps/MahilaMadel/web-app/client/package-lock.json` | Remove; already reported removed in Phase 1 |
| `apps/MahilaMadel/web-app/server/package-lock.json` | Remove; already reported removed in Phase 1 |
| `apps/MahilaMadel/web-app/.gitignore` | Merge any unique rules into the root `.gitignore`, then remove |
| `apps/MahilaMadel/web-app/README.md` | Move to `apps/storefronts/mahila-madel/README.md` and rewrite current/target status honestly |

## Logo and asset correction

Do not preserve the five broken symlinks from the archive.

- Replace each web `public/Zolexora_logo.png` symlink with a real file copied from the uploaded canonical logo.
- Keep one real logo in each consuming Next.js public directory:
  - `apps/storefronts/zolexora-shop/web/public/Zolexora_logo.png`
  - `apps/portals/seller/web/public/Zolexora_logo.png`
  - `apps/portals/marketplace-admin/web/public/Zolexora_logo.png`
- Move `Zolexora_fav.png` to the Zolexora storefront's `public/` directory.
- Do not recreate the two broken mobile logo links. Phase 1 reportedly changed mobile auth screens to their existing `assets/icon.png` files.
- Remove the old `apps/public/` directory after all consumers are verified.

## Backend move constraint

Move `backend/` as one unit to `services/marketplace-api/`. Do not add another `app/` nesting layer during this phase because current imports assume modules such as `core`, `auth`, `routers`, `shipping`, and `users` are importable from the service working directory.

Update only path-dependent configuration:

- Root scripts.
- CI working directories.
- Docker build contexts and `COPY` paths.
- Compose env paths and volumes.
- README/runbook commands.
- Supabase CLI working directory references.
- Stale UI help text mentioning `backend/.env`.

Do not redesign backend modules while moving them.

## Infrastructure treatment

- Root `docker-compose.yml` remains the canonical local stack because that location is conventional and already used by root commands.
- Provider-specific operational files move under `infrastructure/` and remain clearly transitional.
- `vercel.json`, Supabase configuration, Cloudinary code, MongoDB repositories, and old Nginx files are retained until their dedicated Oracle migration phase.
- Moving a provider file does not make it part of the final OCI architecture.
- Do not create empty Terraform or Oracle resource folders during directory reorganization.

## Documentation numbering

Create the repository-layout decision as:

```text
docs/decisions/0006-canonical-repository-layout.md
```

The later storefront-context ADR should therefore become ADR 0007 rather than reusing 0006.

## New or reported files included in the target tree

These are not all present in the uploaded ZIP, but were reported from Phase 1 or are required for Phase 1.5:

```text
AGENTS.md
scripts/verify-workspace.mjs
infrastructure/README.md
docs/README.md
docs/architecture.md
docs/business-modules.md
docs/data-model.md
docs/design.md
docs/domains-and-routing.md
docs/memory.md
docs/oracle-infrastructure.md
docs/payment-architecture.md
docs/phases.md
docs/prd.md
docs/decisions/0001-multi-storefront-shared-platform.md
docs/decisions/0002-oracle-cloud-target.md
docs/decisions/0003-separate-payment-gateways.md
docs/decisions/0004-secure-session-architecture.md
docs/decisions/0005-canonical-pnpm-workspace.md
docs/decisions/0006-canonical-repository-layout.md
docs/runbooks/local-development.md
docs/status/README.md
docs/status/current-status.md
docs/status/feature-matrix.md
docs/status/gap-analysis.md
docs/status/next-actions.md
docs/status/test-baseline.md
docs/status/audits/phase-0-baseline-audit.md
docs/status/audits/phase-1-monorepo-baseline.md
docs/status/audits/phase-1-5-directory-reorganization.md
```

## Files that must not survive under old paths

After successful verification, these old containers should not remain:

```text
apps/ZolexoraShop/
apps/MahilaMadel/
apps/public/
backend/
docs/
supabase/
Dockerfile.frontend
DEPLOYMENT.md
```

The old Mahila npm lockfiles and wrapper package manifest must also be absent.

## Complete companion artifacts

- `Zolexora-current-upload-tree.txt`: exact meaningful tree from a fresh archive extraction.
- `Zolexora-target-tree.txt`: complete projected Phase 1.5 tree.
- `Zolexora-path-mapping.csv`: file-by-file old path, target path, action, lifecycle, and notes.
- `PHASE_1_5_DIRECTORY_REORGANIZATION_PROMPT.md`: execution prompt for the current local repository.

## Phase 1.5 acceptance boundary

The move is complete only when:

1. Exactly nine workspace packages are discovered under the new paths.
2. No active configuration references the old paths.
3. Root build, type-check, lint, tests, and verification execute real packages.
4. FastAPI still compiles, passes Ruff, and passes all existing tests from its new location.
5. Mahila's honest test state is not hidden.
6. Docker Compose configuration resolves with new paths.
7. The three web logos are real files, not broken symlinks.
8. Only one root pnpm lockfile exists.
9. No source behavior, database schema, payment flow, auth architecture, or OCI resource changes are mixed into the move.
10. The Phase 1.5 audit records exact commands, results, and remaining blockers.
