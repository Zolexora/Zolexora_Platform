# Zolexora Platform — AI Agent Operational Guidelines

This repository is a Turborepo/pnpm monorepo housing the Zolexora ecosystem products and services. All AI agents working in this workspace must adhere to these directives.

---

## 1. Monorepo Organization

- **`products/`**: Independent vertical products (e.g., `zolexora-tms`, `zolexora-marketplace`, `the-textile-care`, `rentoeasy`, `clarityfi`, etc.).
- **`packages/`**: Shared TypeScript/Node libraries and configs (`packages/ui`, `packages/api-client`, etc.).
- **`platform/`**: Central platform foundation and core utilities.
- **`apps/`**: Shared platform administration dashboards.
- **`scripts/`**: Monorepo orchestration scripts (`scripts/dev/`, `scripts/setup/`, `scripts/docker/`).
- **`.agents/`**: Customization system containing rules (`.agents/rules/`), skills (`.agents/skills/`), and MCP server configs.

---

## 2. Docker, GHCR & Product Script Standards

When creating, updating, or debugging Docker infrastructure for any product:

1. **Follow the Rule**: Adhere strictly to [.agents/rules/docker-product-standards.md](file:///.agents/rules/docker-product-standards.md).
2. **Root Build Context Mandate**:
   - In this monorepo, **EVERY product and service Docker build** (in CI pipelines, Docker Compose, or manual CLI commands) **MUST use the monorepo root (`.`) as the build context**.
   - All `Dockerfile` definitions across all products must use paths relative to the repository root (e.g., `COPY products/<product>/...`). Never scope build context to a subfolder.
3. **Never Force `--build`**: Startup scripts must NEVER hardcode `up -d --build`. They must pull missing prebuilt images from GitHub Container Registry (`ghcr.io/zolexora/...`) using `pull --ignore-pull-failures` and start with `up -d`.
4. **Always Add GHCR Tags & Pull Policy**:
   In every `compose.yaml`:
   ```yaml
   image: ${PRODUCT_SERVICE_IMAGE:-ghcr.io/zolexora/<product>-<service>:latest}
   pull_policy: missing
   build:
     context: ../../
     dockerfile: products/<product>/Dockerfile.<service>
   ```
5. **Standard Subcommands**:
   Every `products/<product>/scripts/docker-start.sh` must support:
   `start`, `stop`, `restart`, `build`, `pull`, `status`, `logs`.
6. **Standard Package Scripts**:
   Register `docker:<product>:{start|stop|restart|build|pull|logs|status}` in root `package.json`.
7. **Automate with Scaffolder**:
   When adding a new product or scripts, run:
   ```bash
   bash scripts/dev/scaffold-product-docker.sh <product-name>
   ```
8. **Safe Cleanup (Never use raw `docker system prune -a`)**:
   - `pnpm docker:clean`: Fast, safe cleanup of stopped containers, unused networks, and dangling build cache.
   - `pnpm docker:prune`: Deep cleanup (equivalent to `prune -a`) that reclaims maximum disk space while strictly safeguarding DevContainer images (`vsc-*`), volumes (`vscode`), and workspace state.

---

## 3. Secret Management (Infisical)

- **Non-blocking Auth**: Always check Infisical login non-blockingly before executing commands. If not authenticated, notify the developer and fall back cleanly to local `.env` files. Never halt or hang.
- **No Plaintext Leaks**: Never commit decrypted secrets or print production credentials into chat or console logs.

---

## 4. Antigravity & Agent Tooling Protocols

- **Zero Polling**: Never run terminal polling loops waiting for processes. Antigravity wakes up reactively upon task completion.
- **No `sleep`**: Use the native `schedule` tool instead of running `sleep` in terminal commands.
- **Clickable File Links**: Always use GitHub-style markdown file links with the `file://` scheme and basenames (e.g. [package.json](file:///package.json)).
- **Ponytail Minimalism**: Write the simplest, shortest solution that works. Defer unnecessary abstractions, prefer stdlib and native platform features.
