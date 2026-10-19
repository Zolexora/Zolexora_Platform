# Docker & GitHub Container Registry (GHCR) Standards for Products

This rule governs how all products in the Zolexora Platform monorepo must configure Docker Compose, startup scripts, Dockerfiles, and container registries. Every AI agent creating, updating, or debugging product Docker configurations MUST adhere to these directives.

---

## 1. Product Directory Layout

Each product resides under `products/<product-name>/` and follows this layout:

```text
products/<product-name>/
├── compose.yaml                      # Canonical product compose definition
├── Dockerfile.<service> (or in apps/) # Multi-stage container definitions
├── scripts/
│   └── docker-start.sh               # Product Docker management script
└── .infisical.json                   # Infisical secret linkage (if applicable)
```

---

## 2. Docker Compose Standards (`compose.yaml`)

Every service in `compose.yaml` that builds locally MUST adhere to:

1. **Explicit GHCR Image Tag**:
   Always attach `image: ${<PRODUCT>_<SERVICE>_IMAGE:-ghcr.io/zolexora/<product-slug>-<service>:latest}` alongside `build:`.
   *All repository and image names must be strictly lowercase.*
2. **`pull_policy: missing`**:
   Always declare `pull_policy: missing`. This ensures Docker Compose pulls the prebuilt image from GHCR when missing, rather than compiling from scratch.
3. **Preserve `build:` Block**:
   Always keep the `build:` block so developers can still build local changes when explicitly requested.
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
    image: ${TMS_BACKEND_IMAGE:-ghcr.io/zolexora/tms-backend:latest}
    pull_policy: missing
    build:
      context: ./apps/backend
      dockerfile: Dockerfile
    container_name: tms-backend
    ports:
      - "${TMS_BACKEND_PORT:-4031}:4030"
```

---

## 3. Lean Multi-Stage Dockerfile Mandate

Heavy images (>500MB) cause 20–40 minute network pull delays. Every Dockerfile MUST be multi-stage:

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

Every product's `docker-start.sh` MUST:

1. **Always execute from monorepo root**:
   ```bash
   cd "$(dirname "$0")/../../.."
   ```
2. **Non-blocking Infisical Secret Injection**:
   Check credentials or CLI status first. Fall back cleanly to local environment if Infisical is not logged in. Never hang or block.
3. **NEVER hardcode `--build` or forced pulls in default start**:
   - `start_stack()` must run:
     ```bash
     run_compose up -d "$@"
     ```
   - Docker Compose handles pulling automatically when images are missing via `pull_policy: missing`.
   - Day-to-day starts take ~2 seconds with zero network overhead.
4. **Provide standard subcommands**:
   - `start` / `up`: Start stack (pulls automatically if images missing).
   - `stop` / `down`: Stop containers.
   - `restart`: Restart containers cleanly.
   - `build`: Explicitly build containers locally from source.
   - `pull`: Explicitly pull latest images from GHCR.
   - `status` / `ps`: Show container status.
   - `logs`: Stream container logs.

---

## 5. Port Allocation & Conflict Prevention

VS Code DevContainer aggressively auto-forwards specific port ranges. To prevent `address already in use` failures, products MUST avoid these host ports:

| Purpose | Forbidden Host Ports (Held by DevContainer) | Recommended Product Ports |
|:---|:---|:---|
| **Web / Gateway** | `3000-3003`, `3070-3089` | `3090`, `3091`, `3092`, `3095+` |
| **Backend APIs** | `4010`, `4030`, `4090`, `4100`, `4110`, `4120` | `4031`, `4032`, `4040+` |
| **PostgreSQL** | `5432-5445`, `5448` | `5449`, `5450`, `5451+` |

Always expose ports via configurable variables with default fallbacks:
`${<PRODUCT>_<SERVICE>_PORT:-<PORT>}`.

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
"docker:<product>:start": "bash products/<product>/scripts/docker-start.sh start",
"docker:<product>:stop": "bash products/<product>/scripts/docker-start.sh stop",
"docker:<product>:restart": "bash products/<product>/scripts/docker-start.sh restart",
"docker:<product>:build": "bash products/<product>/scripts/docker-start.sh build",
"docker:<product>:pull": "bash products/<product>/scripts/docker-start.sh pull",
"docker:<product>:logs": "bash products/<product>/scripts/docker-start.sh logs",
"docker:<product>:status": "bash products/<product>/scripts/docker-start.sh status"
```

---

## 8. GitHub Actions Workflow (`.github/workflows/docker-ghcr-<product>.yml`)

Automate image building and publishing to GHCR with layer caching:

- **Trigger**: Push to `main` with `paths: ['products/<product>/**', 'packages/**']` + `workflow_dispatch`.
- **Permissions**: `packages: write`, `contents: read`.
- **Registry**: `ghcr.io` with `${{ secrets.GITHUB_TOKEN }}`.
- **Lowercase Owner**: Convert `github.repository_owner` to lowercase (`tr '[:upper:]' '[:lower:]'`).
- **Tags**: Push `:latest` and `:${{ github.sha }}`.
- **Cache**: Use Buildx GHA cache: `cache-from: type=gha,scope=<service>` and `cache-to: type=gha,mode=max,scope=<service>`.
- **Source Label**: Add `org.opencontainers.image.source=https://github.com/${{ github.repository }}` so the package links to the repository's Packages tab.

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
