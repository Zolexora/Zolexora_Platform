# Zolexora Platform — AI Agent Operational Guidelines

This repository is a Turborepo/pnpm monorepo housing the Zolexora ecosystem products and services. All AI agents working in this workspace must adhere to these directives.

---

## 1. Monorepo Organization

- **`packages/`**: All shared libraries and configs, one folder per `@zolexora/<folder>` package (e.g. `utils`, `tsconfig`, `api-shield`, `user-auth-firebase`).
- **`apps/`**: Everything deployable ([apps/README.md](apps/README.md)).
  - **Cross-product apps**: `apps/zolexora-auth-service`, `apps/zolexora-platform-admin`.
  - **Products**: 12 independent vertical products in two categories: `apps/core-platform/zolexora-<product>` (tms, shop, ims, ai, appsuite, engage, erp) and `apps/standalone-apps/<product>` (textile-care, ironclub, rentoeasy, clarityfi, maunkavach — no `zolexora-` prefix). Each uses the same layout: `apps/` (frontends, mobile), `services/` (backends), `packages/` (product-local libs), `scripts/`, `docs/` — see [docs/architecture.md](docs/architecture.md#product-layout).
- **`.github/`**: Workflows are named `<product-folder>-<purpose>.yml` (e.g. `zolexora-tms-docker.yml`, `textile-care-ci.yml`); image builds call `reusable-docker-ghcr.yml`; shared steps live in `.github/actions/` (`setup-node`, `setup-python`, `docker-login`, `infisical`, `notify`).
- **Naming**: npm packages `@zolexora/<product>-<app>`; GHCR images `ghcr.io/zolexora/zolexora-<product>-<service>`.
- **`scripts/`**: Monorepo orchestration scripts (`scripts/dev/`, `scripts/setup/`, `scripts/docker/`).
- **`infrastructure/`**: Shared Dockerfiles, nginx gateway image, database schemas/migrations, Supabase config.
- **`tests/e2e/`**: Cross-product E2E suites (`auth-service`, `tms`).
- **`.agents/`**: Customization system containing rules (`.agents/rules/`), skills (`.agents/skills/`), and MCP server configs (`.agents/mcp.json`).
- **Full file map**: [docs/project-tree.md](docs/project-tree.md) (regenerate with `python3 scripts/dev/project-tree.py` after moving folders).
- **Tooling**: one pnpm workspace + one root `turbo.json` and `pnpm-lock.yaml`; no nested lockfiles. Product `tsconfig.base.json` extends `@zolexora/tsconfig/base.json`. Dependency rules: [docs/architecture.md](docs/architecture.md#dependency-rules).
- **Ports**: [docs/ports.md](docs/ports.md) is the host port registry; never bind host `5432`; update the registry in the same change that adds or moves a port.

---

## 2. Docker, GHCR & Product Script Standards

When creating, updating, or debugging Docker infrastructure for any product:

1. **Follow the Rule**: Adhere strictly to [.agents/rules/docker-product-standards.md](file:///.agents/rules/docker-product-standards.md).
2. **Images are built only in GitHub CI, never locally**: no `build:` blocks in compose, no `docker build` / `compose build` / `--build` in scripts. CI (`reusable-docker-ghcr.yml`) builds every image with the monorepo root (`.`) as context; Dockerfiles use root-relative paths (e.g. `COPY apps/<category>/<product>/...`).
3. **Pull, then start**: startup scripts run a strict `docker compose pull` and then `up -d`. A failed pull stops with a message (run the product's image workflow / log in to GHCR); never fall back to building or `--ignore-pull-failures`.
4. **GHCR Image & Pull Policy** in every `compose.yaml`:
   ```yaml
   image: ${PRODUCT_SERVICE_IMAGE:-ghcr.io/zolexora/zolexora-<product>-<service>:latest}
   pull_policy: missing
   ```
5. **Standard Subcommands**:
   Every `apps/<category>/<product>/scripts/docker-start.sh` wraps `scripts/docker/product-stack.sh` and supports:
   `start`, `stop`, `restart`, `pull`, `status`, `logs`.
6. **Standard Package Scripts**:
   Register `docker:<product>:{start|stop|restart|pull|logs|status}` in root `package.json`.
7. **Automate with Scaffolder**:
   When adding a new product or scripts, run:
   ```bash
   bash scripts/dev/scaffold-product-docker.sh <category>/<product>   # e.g. standalone-apps/foo
   ```
8. **Safe Cleanup (Never use raw `docker system prune -a`)**:
   - `pnpm docker:clean`: Fast, safe cleanup of stopped containers, unused networks, and dangling build cache.
   - `pnpm docker:prune`: Deep cleanup (equivalent to `prune -a`) that reclaims maximum disk space while strictly safeguarding DevContainer images (`vsc-*`), volumes (`vscode`), and workspace state.

---

## 3. Secret Management (Infisical only)

- **Infisical is the only secret source.** No `.env` files, no `.env.example` templates, no fallback to local env, no secret defaults in code or Compose. See [ADR 0003](docs/architecture/adrs/0003-secrets-management-infisical.md) and [docs/secrets.md](docs/secrets.md).
- **One entry point:** run anything that needs secrets via `bash scripts/setup/with-infisical.sh <product-dir> <command>`. It fails fast (never hangs) if Infisical is unavailable; report that to the developer instead of working around it.
- **No Plaintext Leaks**: Never commit decrypted secrets or print secret values into chat or console logs (key names are fine).

---

## 4. Antigravity & Agent Tooling Protocols

- **Zero Polling**: Never run terminal polling loops waiting for processes. Antigravity wakes up reactively upon task completion.
- **No `sleep`**: Use the native `schedule` tool instead of running `sleep` in terminal commands.
- **Clickable File Links**: Always use GitHub-style markdown file links with the `file://` scheme and basenames (e.g. [package.json](file:///package.json)).
- **Ponytail Minimalism**: Write the simplest, shortest solution that works. Defer unnecessary abstractions, prefer stdlib and native platform features.
