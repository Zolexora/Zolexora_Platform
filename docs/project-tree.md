# Project Tree

Generated from `git ls-files` by `python3 scripts/dev/project-tree.py`; rerun it after moving or adding folders. Deep folders are collapsed to a file count. Layout rules: [architecture.md](architecture.md#product-layout).

| Path | Holds |
| --- | --- |
| `products/zolexora-<product>/` | One product each: `apps/` (frontends, mobile), `services/` (backends), `packages/` (product-local libs), `scripts/docker-start.sh`, `docs/`, `compose.yaml`, `.infisical.json` |
| `apps/` | Cross-product apps: `zolexora-auth-service` (identity, :3081), `zolexora-platform-admin` (:3095) |
| `packages/` | Shared libraries, published as `@zolexora/<folder>` |
| `infrastructure/` | Shared Dockerfiles, nginx gateway image, database schemas/migrations, Supabase, Render spec |
| `scripts/` | Repo-wide dev / setup / docker / ports scripts ([README](../scripts/README.md)) |
| `tests/e2e/` | Cross-product E2E suites (auth-service, TMS) |
| `docs/` | Architecture, ADRs, ports, secrets, this tree |
| `.agents/` | AI agent rules, skills, MCP config |
| `.github/` | Workflows (`zolexora-<product>-<purpose>.yml`), composite actions, templates |

```text
Zolexora_Platform/
├── .agents/
│   ├── .codex/
│   │   └── config.toml
│   ├── memory/
│   │   └── ponytail-audit.md
│   ├── rules/
│   │   ├── antigravity.md
│   │   ├── cloudflare.md
│   │   ├── docker-product-standards.md
│   │   ├── ponytail.md
│   │   ├── products.md
│   │   └── workers.md
│   ├── skills/  (766 files, vendored agent skills)
│   ├── mcp.json
│   ├── mcp_config.json -> mcp.json
│   └── skills-lock.json
├── .devcontainer/
│   └── devcontainer.json
├── .github/
│   ├── actions/
│   │   ├── docker-login/  (1 files)
│   │   ├── infisical/  (1 files)
│   │   ├── notify/  (1 files)
│   │   ├── setup-node/  (1 files)
│   │   └── setup-python/  (1 files)
│   ├── DISCUSSION_TEMPLATE/
│   │   ├── ideas.yml
│   │   └── q-a.yml
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml
│   │   ├── config.yml
│   │   ├── documentation.yml
│   │   └── feature_request.yml
│   ├── PULL_REQUEST_TEMPLATE/
│   │   ├── backend.md
│   │   ├── frontend.md
│   │   ├── infrastructure.md
│   │   └── release.md
│   ├── scripts/
│   │   ├── backup.sh
│   │   ├── deploy.sh
│   │   ├── docker-cleanup.sh
│   │   ├── notify.py
│   │   ├── rollback.sh
│   │   └── version.sh
│   ├── workflows/
│   │   ├── codeql.yml
│   │   ├── labeler.yml
│   │   ├── labels.yml
│   │   ├── platform-ci.yml
│   │   ├── pr-title.yml
│   │   ├── reusable-ci.yml
│   │   ├── reusable-docker-ghcr.yml
│   │   ├── security.yml
│   │   ├── stale.yml
│   │   ├── zolexora-ai-ci.yml
│   │   ├── zolexora-ai-deploy.yml
│   │   ├── zolexora-ai-docker.yml
│   │   ├── zolexora-ai-e2e.yml
│   │   ├── zolexora-ai-nightlytests.yml
│   │   ├── zolexora-appsuite-docker.yml
│   │   ├── zolexora-auth-service-ci.yml
│   │   ├── zolexora-auth-service-docker.yml
│   │   ├── zolexora-clarityfi-docker.yml
│   │   ├── zolexora-clarityfi-release.yml
│   │   ├── zolexora-engage-docker.yml
│   │   ├── zolexora-erp-ci.yml
│   │   ├── zolexora-erp-docker.yml
│   │   ├── zolexora-ims-ci.yml
│   │   ├── zolexora-ims-docker.yml
│   │   ├── zolexora-ironclub-docker.yml
│   │   ├── zolexora-marketplace-ci.yml
│   │   ├── zolexora-marketplace-docker.yml
│   │   ├── zolexora-marketplace-release.yml
│   │   ├── zolexora-maunkavach-android.yml
│   │   ├── zolexora-maunkavach-ci.yml
│   │   ├── zolexora-maunkavach-docker.yml
│   │   ├── zolexora-platform-admin-docker.yml
│   │   ├── zolexora-rentoeasy-docker.yml
│   │   ├── zolexora-textile-care-ci.yml
│   │   ├── zolexora-textile-care-docker.yml
│   │   └── zolexora-tms-docker.yml
│   ├── CODE_OF_CONDUCT.md
│   ├── CODEOWNERS
│   ├── CONTRIBUTING.md
│   ├── dependabot.yml
│   ├── FUNDING.yml
│   ├── labeler.yml
│   ├── labels.yml
│   ├── pull_request_template.md
│   ├── release.yml
│   ├── SECURITY.md
│   ├── settings.yml
│   └── SUPPORT.md
├── .vscode/
│   ├── mcp.json -> ../.agents/mcp.json
│   └── settings.json
├── apps/
│   ├── zolexora-auth-service/
│   │   ├── scripts/
│   │   │   └── docker-start.sh
│   │   ├── src/
│   │   │   ├── business/  (1 files)
│   │   │   ├── config/  (3 files)
│   │   │   ├── middleware/  (1 files)
│   │   │   ├── plugins/  (2 files)
│   │   │   ├── rbac/  (2 files)
│   │   │   ├── repositories/  (3 files)
│   │   │   ├── routes/  (15 files)
│   │   │   ├── services/  (14 files)
│   │   │   ├── stores/  (3 files)
│   │   │   ├── verification/  (3 files)
│   │   │   ├── app.ts
│   │   │   ├── db.ts
│   │   │   └── index.ts
│   │   ├── test/
│   │   │   ├── helpers/  (5 files)
│   │   │   ├── adversarial-auth-tracks.test.ts
│   │   │   ├── adversarial.test.ts
│   │   │   ├── app.test.ts
│   │   │   ├── business-team.test.ts
│   │   │   ├── infisical-secrets.test.ts
│   │   │   ├── security-regressions.test.ts
│   │   │   ├── setup.ts
│   │   │   ├── storage-kyc.test.ts
│   │   │   ├── storage-media.test.ts
│   │   │   ├── token.test.ts
│   │   │   ├── track1-firebase.test.ts
│   │   │   ├── turnstile.test.ts
│   │   │   └── verification.test.ts
│   │   ├── .infisical.json
│   │   ├── compose.yaml
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   └── zolexora-platform-admin/
│       ├── backend/
│       │   ├── app/  (23 files)
│       │   ├── tests/  (10 files)
│       │   ├── Dockerfile
│       │   ├── requirements-dev.txt
│       │   └── requirements.txt
│       ├── frontend/
│       │   ├── public/  (2 files)
│       │   ├── src/  (27 files)
│       │   ├── tests/  (1 files)
│       │   ├── .eslintrc.json
│       │   ├── Dockerfile
│       │   ├── next-env.d.ts
│       │   ├── next.config.js
│       │   ├── package.json
│       │   ├── postcss.config.js
│       │   ├── tailwind.config.js
│       │   └── tsconfig.json
│       ├── nginx-conf.d/
│       │   └── default.conf
│       ├── scripts/
│       │   └── docker-start.sh
│       ├── .infisical.json
│       ├── compose.yaml
│       └── Dockerfile.nginx
├── docs/
│   ├── architecture/
│   │   ├── adrs/
│   │   │   ├── 0001-record-architecture-decisions.md
│   │   │   ├── 0002-monorepo-tooling.md
│   │   │   ├── 0003-secrets-management-infisical.md
│   │   │   ├── 0004-shared-identity-org-profile-kyc.md
│   │   │   └── 0005-roles-permissions-engine.md
│   │   ├── infrastructure/
│   │   │   ├── 01-supabase-management.md
│   │   │   ├── 02-mongodb-management.md
│   │   │   ├── 03-cloudflare-d1-r2-management.md
│   │   │   ├── 04-cloudinary-management.md
│   │   │   ├── 05-database-cluster-strategy.md
│   │   │   ├── 06-zero-cost-autonomous-architecture.md
│   │   │   ├── 07-implementation-plan.md
│   │   │   ├── 08-deployment-strategy.md
│   │   │   ├── 09-api-security-strategy.md
│   │   │   ├── 10-dual-production-strategy.md
│   │   │   ├── 11-cloud-management-system.md
│   │   │   ├── 12-authentication-architecture.md
│   │   │   ├── 13-dynamic-account-router-and-monitoring.md
│   │   │   └── CREDENTIAL_STORAGE_PLAN.md
│   │   └── unified-firebase-auth-guide.md
│   ├── architecture.md
│   ├── ports.md
│   ├── project-tree.md
│   └── secrets.md
├── infrastructure/
│   ├── cloud/
│   │   └── render.yaml
│   ├── containers/
│   │   ├── compose/
│   │   │   ├── nginx-conf.d/  (1 files)
│   │   │   ├── Dockerfile.nginx
│   │   │   └── nginx.conf
│   │   ├── docker/
│   │   │   ├── Dockerfile
│   │   │   ├── Dockerfile.api-python
│   │   │   ├── Dockerfile.api-python.dockerignore
│   │   │   ├── Dockerfile.cra
│   │   │   ├── Dockerfile.nextjs
│   │   │   ├── Dockerfile.nextjs.dockerignore
│   │   │   └── postgres-test.compose.yml
│   │   └── README.md
│   ├── database/
│   │   ├── migrations/
│   │   │   ├── 001_auth_migration.sql
│   │   │   ├── 20260530151849_init_schema.sql
│   │   │   └── 202609100001_phase1_foundation.sql
│   │   ├── schemas/
│   │   │   ├── schema.sql
│   │   │   └── schema_v2.sql
│   │   └── README.md
│   ├── supabase/
│   │   ├── .gitignore
│   │   ├── config.toml
│   │   └── migrations -> ../database/migrations
│   ├── compose -> containers/compose
│   ├── docker -> containers/docker
│   └── README.md
├── packages/
│   ├── api-contracts/
│   │   ├── src/  (2 files)
│   │   ├── openapi.yaml
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── api-shield/
│   │   ├── src/  (6 files)
│   │   ├── test/  (4 files)
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── tsconfig.json
│   │   └── wrangler.jsonc
│   ├── auth-client/
│   │   ├── src/  (23 files)
│   │   ├── tests/  (8 files)
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── vitest.config.ts
│   ├── auth-functions/
│   │   ├── src/  (2 files)
│   │   ├── .gitignore
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── eslint-config/
│   │   ├── index.js
│   │   └── package.json
│   ├── tsconfig/
│   │   ├── base.json
│   │   └── package.json
│   ├── user-auth-firebase/
│   │   ├── native/  (6 files)
│   │   ├── src/  (14 files)
│   │   ├── tests/  (2 files)
│   │   ├── expo-config.cjs
│   │   ├── package.json
│   │   ├── README.md
│   │   └── tsconfig.json
│   ├── user-auth-zolexora/
│   │   ├── src/  (10 files)
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── schema.sql
│   │   └── tsconfig.json
│   └── utils/
│       ├── src/  (4 files)
│       ├── tests/  (4 files)
│       ├── package.json
│       └── tsconfig.json
├── products/
│   ├── zolexora-ai/
│   │   ├── .devcontainer/
│   │   │   ├── devcontainer-lock.json
│   │   │   └── devcontainer.json
│   │   ├── apps/
│   │   │   └── web/  (36 files)
│   │   ├── docs/
│   │   │   └── planning/  (1 files)
│   │   ├── infra/
│   │   │   └── azure/  (3 files)
│   │   ├── nginx-conf.d/
│   │   │   └── default.conf
│   │   ├── scripts/
│   │   │   ├── deploy-azure.sh
│   │   │   ├── docker-start.sh
│   │   │   ├── seed-ai-memory.sh
│   │   │   └── setup-azure-resources.sh
│   │   ├── services/
│   │   │   └── api/  (105 files)
│   │   ├── .gitignore
│   │   ├── .infisical.json
│   │   ├── ARCHITECTURE.md
│   │   ├── compose.yaml
│   │   ├── Dockerfile.nginx
│   │   ├── GEMINI.md
│   │   ├── nginx.conf
│   │   └── README.md
│   ├── zolexora-appsuite/
│   │   ├── apps/
│   │   │   ├── client/  (66 files)
│   │   │   └── dev-team/  (50 files)
│   │   ├── docs/
│   │   │   ├── branding/  (2 files)
│   │   │   └── ARCHITECTURE.md
│   │   ├── nginx-conf.d/
│   │   │   ├── default.conf
│   │   │   └── ssl.conf.template
│   │   ├── scripts/
│   │   │   ├── docker-start.sh
│   │   │   └── setup-production-vm.sh
│   │   ├── services/
│   │   │   └── backend/  (14 files)
│   │   ├── .infisical.json
│   │   ├── compose.yaml
│   │   ├── Dockerfile.backend
│   │   ├── Dockerfile.client
│   │   ├── Dockerfile.devteam
│   │   ├── Dockerfile.nginx
│   │   ├── nginx.conf
│   │   ├── package.json
│   │   └── README.md
│   ├── zolexora-clarityfi/
│   │   ├── apps/
│   │   │   ├── mobile/  (50 files)
│   │   │   └── web/  (3 files)
│   │   ├── nginx-conf.d/
│   │   │   └── default.conf
│   │   ├── packages/
│   │   │   ├── api-client-react/  (6 files)
│   │   │   ├── api-spec/  (3 files)
│   │   │   ├── api-zod/  (6 files)
│   │   │   └── db/  (5 files)
│   │   ├── scripts/
│   │   │   ├── docker-start.sh
│   │   │   └── verify-tunnel.js
│   │   ├── services/
│   │   │   └── api/  (8 files)
│   │   ├── .gitattributes
│   │   ├── .gitignore
│   │   ├── .infisical.json
│   │   ├── .npmrc
│   │   ├── compose.yaml
│   │   ├── Dockerfile.api
│   │   ├── Dockerfile.nginx
│   │   ├── Dockerfile.web
│   │   ├── nginx.conf
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── tsconfig.base.json
│   │   ├── tsconfig.json
│   │   └── vercel.json
│   ├── zolexora-engage/
│   │   ├── apps/
│   │   │   └── web/  (31 files)
│   │   ├── docs/
│   │   │   └── setup/  (1 files)
│   │   ├── nginx-conf.d/
│   │   │   └── default.conf
│   │   ├── packages/
│   │   │   ├── api-client-react/  (6 files)
│   │   │   ├── api-spec/  (3 files)
│   │   │   ├── api-zod/  (14 files)
│   │   │   └── db/  (5 files)
│   │   ├── scripts/
│   │   │   ├── docker-start.sh
│   │   │   ├── run-post-merge-hooks.sh
│   │   │   ├── start-project.sh
│   │   │   └── start-web-dev.sh
│   │   ├── services/
│   │   │   └── api/  (9 files)
│   │   ├── .gitignore
│   │   ├── .infisical.json
│   │   ├── .npmrc
│   │   ├── compose.yaml
│   │   ├── Dockerfile.api
│   │   ├── Dockerfile.nginx
│   │   ├── Dockerfile.web
│   │   ├── nginx.conf
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── tsconfig.base.json
│   │   └── tsconfig.json
│   ├── zolexora-erp/
│   │   ├── docs/
│   │   │   ├── admin-guide.md
│   │   │   ├── api-guide.md
│   │   │   ├── architecture.md
│   │   │   ├── backup.md
│   │   │   ├── cloudflare.md
│   │   │   ├── deployment.md
│   │   │   ├── developer-guide.md
│   │   │   ├── installation.md
│   │   │   ├── northflank.md
│   │   │   ├── production-guide.md
│   │   │   ├── README.md
│   │   │   ├── restore.md
│   │   │   ├── roadmap.md
│   │   │   ├── security-guide.md
│   │   │   ├── testing-guide.md
│   │   │   └── user-guide.md
│   │   ├── scripts/
│   │   │   ├── tests/  (3 files)
│   │   │   ├── backup-frappe-site.sh
│   │   │   ├── bootstrap-frappe-site.sh
│   │   │   ├── check-frappe-stack-health.sh
│   │   │   ├── cleanup-workspaces.py
│   │   │   ├── docker-start.sh
│   │   │   ├── report-frappe-stack-status.sh
│   │   │   ├── restore-frappe-site.sh
│   │   │   └── schedule-daily-backup.sh
│   │   ├── services/
│   │   │   └── frappe/  (80 files)  [contains git submodules]
│   │   ├── .infisical.json
│   │   ├── compose.yaml
│   │   └── README.md
│   ├── zolexora-ims/
│   │   ├── apps/
│   │   │   └── ims-user/  (57 files)
│   │   ├── database/
│   │   │   ├── one-time-reset-demo-schema.sql
│   │   │   └── wrangler.toml
│   │   ├── docs/
│   │   │   ├── planning/  (2 files)
│   │   │   └── security/  (2 files)
│   │   ├── scripts/
│   │   │   ├── check-health.sh
│   │   │   ├── db-ops.sh
│   │   │   ├── docker-start.sh
│   │   │   ├── menu.sh
│   │   │   ├── run-all-tests.sh
│   │   │   └── setup.sh
│   │   ├── services/
│   │   │   └── user-api/  (19 files)
│   │   ├── .gitignore
│   │   ├── .infisical.json
│   │   ├── compose.yaml
│   │   ├── docker-entrypoint-env.sh
│   │   ├── package.json
│   │   └── README.md
│   ├── zolexora-ironclub/
│   │   ├── apps/
│   │   │   ├── admin-web/  (7 files)
│   │   │   ├── manager-mobile/  (5 files)
│   │   │   ├── manager-web/  (7 files)
│   │   │   ├── marketing-web/  (7 files)
│   │   │   └── member-mobile/  (5 files)
│   │   ├── docs/
│   │   │   ├── API_SPEC.md
│   │   │   ├── ARCHITECTURE.md
│   │   │   └── IOT_GATEWAY.md
│   │   ├── nginx-conf.d/
│   │   │   └── ironclub.conf
│   │   ├── packages/
│   │   │   └── types/  (3 files)
│   │   ├── scripts/
│   │   │   ├── dev.sh
│   │   │   ├── docker-start.sh
│   │   │   └── test.sh
│   │   ├── services/
│   │   │   └── backend/  (22 files)
│   │   ├── .gitignore
│   │   ├── .infisical.json
│   │   ├── compose.yaml
│   │   ├── Dockerfile.nginx
│   │   ├── Dockerfile.vite-app
│   │   ├── nginx.conf
│   │   ├── package.json
│   │   └── README.md
│   ├── zolexora-marketplace/
│   │   ├── apps/
│   │   │   ├── portals/  (79 files)
│   │   │   └── storefronts/  (127 files)
│   │   ├── contracts/
│   │   │   ├── marketplace/  (1 files)
│   │   │   └── zolexora-erp/  (21 files)
│   │   ├── docs/
│   │   │   ├── agents/  (4 files)
│   │   │   ├── api-test-reports/  (8 files)
│   │   │   ├── architecture/  (12 files)
│   │   │   ├── decisions/  (16 files)
│   │   │   ├── directory-plan/  (4 files)
│   │   │   ├── legacy/  (3 files)
│   │   │   ├── planning/  (5 files)
│   │   │   ├── runbooks/  (4 files)
│   │   │   ├── status/  (25 files)
│   │   │   ├── README.md
│   │   │   └── SECURITY.md
│   │   ├── nginx-conf.d/
│   │   │   └── default.conf
│   │   ├── packages/
│   │   │   ├── mobile-sign-in/  (7 files)
│   │   │   ├── shared-api/  (9 files)
│   │   │   ├── shared-config/  (3 files)
│   │   │   └── sign-in/  (9 files)
│   │   ├── scripts/
│   │   │   ├── tests/  (1 files)
│   │   │   ├── check-openapi-drift.sh
│   │   │   ├── docker-start.sh
│   │   │   ├── generate-openapi.py
│   │   │   ├── py-exec.mjs
│   │   │   ├── validate-doc-links.py
│   │   │   ├── validate-erp-contracts.py
│   │   │   ├── validate-postgresql-schema.py
│   │   │   ├── verify-workspace.mjs
│   │   │   └── web-env-config.sh
│   │   ├── services/
│   │   │   └── marketplace-api/  (232 files)
│   │   ├── .gitignore
│   │   ├── .infisical.json
│   │   ├── compose.yaml
│   │   ├── Dockerfile.nginx
│   │   ├── nginx.conf
│   │   ├── package.json
│   │   └── README.md
│   ├── zolexora-maunkavach/
│   │   ├── apps/
│   │   │   ├── android/  (55 files)
│   │   │   └── web/  (84 files)
│   │   ├── docs/
│   │   │   └── reports/  (1 files)
│   │   ├── gradle/
│   │   │   └── wrapper/  (2 files)
│   │   ├── nginx-conf.d/
│   │   │   └── default.conf
│   │   ├── scripts/
│   │   │   └── docker-start.sh
│   │   ├── services/
│   │   │   └── backend/  (8 files)
│   │   ├── .gitignore
│   │   ├── .infisical.json
│   │   ├── build.gradle.kts
│   │   ├── compose.yaml
│   │   ├── DEPLOY.md
│   │   ├── Dockerfile.api
│   │   ├── Dockerfile.nginx
│   │   ├── Dockerfile.web
│   │   ├── gradle.properties
│   │   ├── gradlew
│   │   ├── nginx.conf
│   │   ├── README.md
│   │   └── settings.gradle.kts
│   ├── zolexora-rentoeasy/
│   │   ├── apps/
│   │   │   ├── web-admin/  (16 files)
│   │   │   ├── web-owner/  (23 files)
│   │   │   └── web-tenant/  (28 files)
│   │   ├── nginx-conf.d/
│   │   │   └── default.conf
│   │   ├── packages/
│   │   │   ├── shared-types/  (2 files)
│   │   │   └── shared-utils/  (3 files)
│   │   ├── scripts/
│   │   │   ├── docker-start.sh
│   │   │   └── migrate-prisma-codespaces.sh
│   │   ├── services/
│   │   │   └── api/  (54 files)
│   │   ├── .gitignore
│   │   ├── .infisical.json
│   │   ├── compose.yaml
│   │   ├── Dockerfile.api
│   │   ├── Dockerfile.nginx
│   │   ├── Dockerfile.web
│   │   ├── nginx.conf
│   │   ├── package.json
│   │   ├── README.md
│   │   └── tsconfig.base.json
│   ├── zolexora-textile-care/
│   │   ├── apps/
│   │   │   ├── admin-web/  (34 files)
│   │   │   ├── driver-mobile/  (5 files)
│   │   │   ├── marketplace-mobile/  (5 files)
│   │   │   ├── marketplace-web/  (66 files)
│   │   │   ├── seller-mobile/  (5 files)
│   │   │   └── seller-web/  (35 files)
│   │   ├── docs/
│   │   │   ├── app-factory/  (1 files)
│   │   │   ├── architecture/  (16 files)
│   │   │   ├── customization/  (1 files)
│   │   │   ├── database/  (4 files)
│   │   │   ├── decisions/  (9 files)
│   │   │   ├── deployment/  (1 files)
│   │   │   ├── phase7/  (3 files)
│   │   │   ├── project-status/  (4 files)
│   │   │   ├── security/  (4 files)
│   │   │   ├── white-label/  (1 files)
│   │   │   └── README.md
│   │   ├── nginx-conf.d/
│   │   │   └── default.conf
│   │   ├── packages/
│   │   │   ├── api-client/  (6 files)
│   │   │   ├── auth/  (5 files)
│   │   │   ├── branding/  (5 files)
│   │   │   ├── config/  (5 files)
│   │   │   ├── tenant/  (5 files)
│   │   │   ├── types/  (12 files)
│   │   │   └── ui/  (9 files)
│   │   ├── scripts/
│   │   │   ├── docker-start.sh
│   │   │   ├── start-docker.sh
│   │   │   └── start-local.sh
│   │   ├── services/
│   │   │   └── backend/  (194 files)
│   │   ├── .gitignore
│   │   ├── .infisical.json
│   │   ├── compose.yaml
│   │   ├── Dockerfile.nginx
│   │   ├── Dockerfile.web
│   │   ├── nginx.conf
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── tsconfig.base.json
│   │   └── tsconfig.json
│   ├── zolexora-tms/
│   │   ├── apps/
│   │   │   ├── tms-admin/  (19 files)
│   │   │   ├── tms-mobile/  (35 files)
│   │   │   └── tms-web/  (61 files)
│   │   ├── docs/
│   │   │   ├── agents/  (2 files)
│   │   │   ├── architecture/  (25 files)
│   │   │   ├── authentication/  (1 files)
│   │   │   ├── branding/  (2 files)
│   │   │   ├── customizations/  (1 files)
│   │   │   ├── database/  (1 files)
│   │   │   └── ecosystem_and_tooling/  (1 files)
│   │   ├── nginx-conf.d/
│   │   │   └── default.conf
│   │   ├── scripts/
│   │   │   ├── docker-start.sh
│   │   │   └── local-start.sh
│   │   ├── services/
│   │   │   └── backend/  (187 files)
│   │   ├── .gitignore
│   │   ├── .infisical.json
│   │   ├── compose.yaml
│   │   ├── docker-entrypoint-env.sh
│   │   ├── Dockerfile.nginx
│   │   ├── Dockerfile.web
│   │   ├── nginx-web.conf
│   │   ├── nginx.conf
│   │   ├── package.json
│   │   └── README.md
│   └── README.md
├── scripts/
│   ├── audits/
│   │   └── codebase-audit.sh
│   ├── auth/
│   │   └── assign-admin.py
│   ├── db/
│   │   ├── auth-service-admin-schema.sql
│   │   ├── auth-service-schema.sql
│   │   ├── auth-service-upgrade-identity.sql
│   │   ├── auth-service-upgrade-track1-firebase.sql
│   │   ├── auth-service-upgrade-users.sql
│   │   ├── migrate-schemas.sql
│   │   └── stress_test_render_postgres.py
│   ├── dev/
│   │   ├── project-tree.py
│   │   ├── scaffold-product-docker.sh
│   │   ├── setup-cli-ecosystem.sh
│   │   ├── setup-devcontainer.sh
│   │   └── start-all-products-dev.sh
│   ├── docker/
│   │   ├── configure-frappe-common-site.sh
│   │   ├── product-stack.sh
│   │   ├── prune-except-devcontainer.sh
│   │   └── yarn-wrapper.sh
│   ├── ports/
│   │   ├── patch-backend-service-ports.py
│   │   └── patch-frontend-dev-ports.js
│   ├── setup/
│   │   ├── infisical-init.sh
│   │   ├── start.sh
│   │   └── with-infisical.sh
│   └── README.md
├── tests/
│   └── e2e/
│       ├── auth-service/
│       │   ├── helpers/  (5 files)
│       │   ├── tier1-features/  (10 files)
│       │   ├── tier2-boundaries/  (1 files)
│       │   ├── tier3-combinations/  (1 files)
│       │   ├── tier4-workloads/  (1 files)
│       │   ├── tier5-adversarial/  (1 files)
│       │   ├── challenger-empirical-attacks.mjs
│       │   ├── challenger-gen8-it2-comprehensive.mjs
│       │   ├── challenger-m3-2-it2-isolation.mjs
│       │   ├── challenger-m4-2-it2-adversarial-probe.mjs
│       │   ├── challenger-m4-empirical-attacks.mjs
│       │   ├── challenger-m6-2-empirical-harness.mjs
│       │   ├── challenger-m6-empirical-probe.mjs
│       │   ├── empirical-adversarial-probe.mjs
│       │   ├── empirical-signed-url-probe.mjs
│       │   ├── package.json
│       │   ├── README.md
│       │   ├── run_all.sh
│       │   └── vitest.config.ts
│       └── tms/
│           ├── __init__.py
│           ├── conftest.py
│           ├── helpers.py
│           ├── run_all.py
│           ├── run_all.sh
│           ├── test_tier1_features.py
│           ├── test_tier2_boundaries.py
│           ├── test_tier3_combinations.py
│           ├── test_tier4_workloads.py
│           ├── test_tier5_adversarial.py
│           └── test_tier5_security.py
├── .dockerignore
├── .eslintrc.json
├── .firebaserc
├── .gitattributes
├── .gitignore
├── .gitmodules
├── .hintrc
├── .infisical.json
├── .npmrc
├── .pre-commit-config.yaml
├── .prettierrc.json
├── AGENTS.md
├── firebase.json
├── firestore.rules
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── README.md
├── tsconfig.json
├── turbo.json
└── vitest.workspace.ts
```
