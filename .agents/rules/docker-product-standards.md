# Docker & GitHub Container Registry (GHCR) Standards for Products

This rule governs how all products in the Zolexora Platform monorepo must configure Docker Compose, startup scripts, Dockerfiles, and container registries. Every AI agent creating, updating, or debugging product Docker configurations MUST adhere to these directives.

---

## 1. Product Directory Layout

Each product resides under `apps/<category>/<product>/` (`core-platform/zolexora-<name>` or `standalone-apps/<name>`) and follows this layout:

```text
apps/<category>/<product>/
├── apps/                             # Frontends, mobile, edge workers
├── services/                         # Backends (FastAPI, Express, NestJS, Frappe)
├── packages/                         # Product-local shared code
├── compose.yaml                      # Canonical product compose definition
├── Dockerfile.<service>              # Or services/<svc>/Dockerfile — always root-relative
├── nginx.conf, nginx-conf.d/         # Product gateway
├── scripts/
│   └── docker-start.sh               # Product Docker management script
└── .infisical.json                   # Infisical folder for this product (required)
```

Full layout: [docs/architecture.md](../../docs/architecture.md#product-layout).

---

## 2. Docker Compose Standards (`compose.yaml`)

**Images are built only by GitHub CI and pulled from GHCR. They are never built locally** (not by
developers, scripts, agents or deploy hosts). Every service in `compose.yaml` that runs a Zolexora image MUST:

1. **Reference the GHCR image**:
   `image: ${<PRODUCT>_<SERVICE>_IMAGE:-ghcr.io/zolexora/<product-slug>-<service>:latest}`.
   *All repository and image names must be strictly lowercase.*
2. **Declare `pull_policy: missing`**.
3. **Have no `build:` block.** Build settings (Dockerfile, target, build args) live only in the
   product's image workflow (section 8). To try an unmerged change in a container, run that workflow.
4. **Port Overrides via Environment Variables**:
   Never hardcode raw host ports that collide with VS Code DevContainer forwards. Use configurable defaults:
   ```yaml
   ports:
     - "${PRODUCT_BACKEND_PORT:-4031}:4030"
     - "${PRODUCT_PORT:-3090}:80"
   ```

### Example:
```yaml
services:
  backend:
    image: ${TMS_BACKEND_IMAGE:-ghcr.io/zolexora/zolexora-tms-backend:latest}
    pull_policy: missing
    container_name: tms-backend
    ports:
      - "${TMS_BACKEND_PORT:-4031}:4030"
```

---

## 3. Lean Multi-Stage Dockerfile Mandate

Heavy images (>500MB) cause 20–40 minute network pull delays. Every Dockerfile MUST be multi-stage:

0. **Root Build Context & Root-Relative COPY Paths**:
   - CI builds every image with the monorepo root (`.`) as context; never a product subfolder.
   - Because of that, all `COPY` commands must use repository root-relative paths (e.g., `COPY apps/<category>/<product>/apps/web ...`, `COPY package.json ...`).
   - Never assume the Dockerfile's local directory is the build context.
1. **Separate Builder and Runner Stages**:
   - Compilers (`build-essential`, `gcc`, `make`, build SDKs) must ONLY live in the `builder` stage.
   - The final `runner` stage must only contain runtime libraries (e.g. `libpq5`, `ca-certificates`) and the compiled artifact / virtual environment.
2. **Layer Order for Maximum Cache Reuse**:
   - Order layers from least frequently changed to most frequently changed:
     1. Base OS image (`python:3.12-slim`, `node:22-alpine`, etc.)
     2. System packages
     3. Package manager & lockfiles (`pyproject.toml`, `uv.lock`, `package.json`, `pnpm-lock.yaml`)
     4. Dependency install (`uv sync --frozen --no-install-project`, `pnpm install`)
     5. Application source code (`COPY app ./app`, `COPY src ./src`)
   - *Result*: Day-to-day code edits only invalidate the final ~1MB app layer.
3. **Target Image Size**:
   - Python backends: < 150MB compressed (< 450MB uncompressed).
   - Node / Web frontends (Nginx): < 30MB compressed (< 110MB uncompressed).
   - Never leave package caches (`--no-cache-dir`, `rm -rf /var/lib/apt/lists/*`).

---

## 4. Startup Script Standards (`scripts/docker-start.sh`)

Every product's `docker-start.sh` is a one-line wrapper around the shared
[scripts/docker/product-stack.sh](../../scripts/docker/product-stack.sh) (the scaffolder writes it):

```bash
exec bash "$(dirname "$0")/../../../scripts/docker/product-stack.sh" "$(dirname "$0")/.." "$@"
```

The shared script runs every compose call through `scripts/setup/with-infisical.sh` (Infisical only,
fails fast) and provides:

- `start` / `up`: `docker compose pull` (strict), then `up -d`. If an image cannot be pulled it stops and
  says to run the product's image workflow or log in to GHCR; it never builds instead.
- `stop` / `down`, `restart`, `pull`, `status` / `ps`, `logs`.
- There is no `build` subcommand. Never add `--build`, `docker build`, `compose build` or
  `--ignore-pull-failures` to any script.

---

## 5. Port Allocation & Conflict Prevention

[docs/ports.md](../../docs/ports.md) is the host port registry and source of truth: pick a free port from it and update it in the same PR.

- Gateway: `${<PRODUCT>_PORT:-30XX}:80`. Backend APIs: `40XX`. Postgres: `${<PRODUCT>_POSTGRES_PORT:-54XX}:5432` — never bind host `5432`.
- Inside Docker, services use default ports (`postgres:5432`, `redis:6379`); only host bindings are offset.
- Never hardcode a host port; always `${<PRODUCT>_<SERVICE>_PORT:-<PORT>}`.

---

## 6. Two-Tier Docker Cleanup Protocol

AI agents and developers must NEVER use raw `docker system prune -a` (which destroys DevContainer images and forces 40-minute rebuilds).

Instead, use the two-tier platform commands:
1. **`pnpm docker:clean` (Daily / Routine)**:
   - Removes stopped containers, orphaned networks, and dangling build cache.
   - **Never deletes named/cached images**. Next start remains instant (~2s).
2. **`pnpm docker:prune` (Deep Cleanup / Max Space)**:
   - Equivalent to `prune -a`: cleans all product containers, images, and caches to reclaim 20+ GB.
   - **Strictly safeguards DevContainer images (`vsc-*`), volumes (`vscode`), and workspace state**.
   - Uses `scripts/docker/prune-except-devcontainer.sh`.

---

## 7. `package.json` Standard Scripts

When a product is dockerized, register these scripts in root `package.json`:

```json
"docker:<product>:start": "bash apps/<category>/<product>/scripts/docker-start.sh start",
"docker:<product>:stop": "bash apps/<category>/<product>/scripts/docker-start.sh stop",
"docker:<product>:restart": "bash apps/<category>/<product>/scripts/docker-start.sh restart",
"docker:<product>:pull": "bash apps/<category>/<product>/scripts/docker-start.sh pull",
"docker:<product>:logs": "bash apps/<category>/<product>/scripts/docker-start.sh logs",
"docker:<product>:status": "bash apps/<category>/<product>/scripts/docker-start.sh status"
```

---

## 8. GitHub Actions Workflow (`.github/workflows/zolexora-<product>-docker.yml`)

Every product's image workflow is a thin caller of `.github/workflows/reusable-docker-ghcr.yml`:

- **Trigger**: push to `main` with `paths: ['apps/<category>/<product>/**', 'packages/**', ...]` + `workflow_dispatch`.
- **Permissions**: `packages: write`, `contents: read`.
- **Input `services`**: a JSON list with one entry per image the product's `compose.yaml` uses (this is the only place build settings live):
  `[{"service":"backend","file":"apps/<category>/<product>/services/backend/Dockerfile","build-args":"K=V","target":""}]`.
- The reusable workflow builds from the repo root, logs in via `.github/actions/docker-login`, and pushes
  `ghcr.io/zolexora/zolexora-<product>-<service>:<sha>` plus `:latest` from `main` only (a manual run on another
  branch pushes `:<branch>` instead, so it never replaces what everyone pulls), with Buildx GHA cache and OCI labels.
- To run a branch build locally, set the compose image variable, e.g.
  `IMS_USER_BACKEND_IMAGE=ghcr.io/zolexora/zolexora-ims-user-backend:<branch> bash apps/core-platform/zolexora-ims/scripts/docker-start.sh start`.
- The image name must equal the compose `image:` default.
- Builds that need build-time secrets (e.g. AppSuite `NEXT_PUBLIC_*`) load them with `.github/actions/infisical`.

---

## 9. Helper Scaffolding Tool

When onboarding a new product or generating docker scripts, use:
```bash
bash scripts/dev/scaffold-product-docker.sh <product-name>
```
Or run with `--check` to audit existing products for compliance:
```bash
bash scripts/dev/scaffold-product-docker.sh --check
```
