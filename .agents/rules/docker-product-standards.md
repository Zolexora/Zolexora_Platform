# Docker & GitHub Container Registry (GHCR) Standards for Products

This rule governs how all products in the Zolexora Platform monorepo must configure Docker Compose, startup scripts, and container registries. Every AI agent creating, updating, or debugging product Docker configurations MUST follow these standards.

---

## 1. Product Directory Layout

Each product resides under `products/<product-name>/` and follows this layout:

```text
products/<product-name>/
├── compose.yaml                      # Canonical product compose definition
├── Dockerfile.<service> (or in apps/) # Container definitions
├── scripts/
│   └── docker-start.sh               # Product Docker management script
└── .infisical.json                   # Infisical secret linkage (if applicable)
```

---

## 2. Docker Compose Standards (`compose.yaml`)

Every service in `compose.yaml` that builds locally MUST adhere to:

1. **Explicit GHCR Image Tag**:
   Always attach `image: ${<PRODUCT>_<SERVICE>_IMAGE:-ghcr.io/zolexora/<product-slug>-<service>:latest}` alongside `build:`.
   *All repository names must be strictly lowercase.*
2. **`pull_policy: missing`**:
   Always declare `pull_policy: missing`. This ensures Docker Compose pulls the prebuilt image from GHCR when missing, rather than compiling from scratch.
3. **Preserve `build:` Block**:
   Always keep the `build:` block so developers can still build local changes when explicitly requested.

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
    ...
```

---

## 3. Startup Script Standards (`scripts/docker-start.sh`)

Every product's `docker-start.sh` MUST:

1. **Always execute from monorepo root**:
   ```bash
   cd "$(dirname "$0")/../../.."
   ```
2. **Non-blocking Infisical Secret Injection**:
   Check credentials or CLI status first. Fall back cleanly to local environment if Infisical is not logged in. Never hang or block.
3. **NEVER hardcode `--build` in default start**:
   - `start` / `up` must run:
     ```bash
     run_compose pull --ignore-pull-failures 2>/dev/null || true
     run_compose up -d "$@"
     ```
   - Pre-built images are pulled in ~10 seconds after cleanups. Start takes ~2 seconds when images exist locally.
4. **Provide explicit `build` and `pull` subcommands**:
   The script must support these standard actions:
   - `start` / `up`: Pull if missing, then start.
   - `stop` / `down`: Stop containers.
   - `restart`: Restart containers.
   - `build`: Explicitly build containers locally from source.
   - `pull`: Explicitly pull latest images from GHCR.
   - `status` / `ps`: Show container status.
   - `logs`: Stream container logs.

---

## 4. `package.json` Standard Scripts

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

## 5. GitHub Actions Workflow (`.github/workflows/docker-ghcr-<product>.yml`)

Automate image building and publishing to GHCR with layer caching:

- **Trigger**: Push to `main` with `paths: ['products/<product>/**', 'packages/**']` + `workflow_dispatch`.
- **Permissions**: `packages: write`, `contents: read`.
- **Registry**: `ghcr.io` with `${{ secrets.GITHUB_TOKEN }}`.
- **Lowercase Owner**: Convert `github.repository_owner` to lowercase (`tr '[:upper:]' '[:lower:]'`).
- **Tags**: Push `:latest` and `:${{ github.sha }}`.
- **Cache**: Use Buildx GHA cache: `cache-from: type=gha,scope=<service>` and `cache-to: type=gha,mode=max,scope=<service>`.
- **Source Label**: Add `org.opencontainers.image.source=https://github.com/${{ github.repository }}` so the package links to the repository's Packages tab.

---

## 6. Helper Scaffolding Tool

When onboarding a new product or generating docker scripts, use:
```bash
bash scripts/dev/scaffold-product-docker.sh <product-name>
```
Or run with `--check` to audit existing products for compliance:
```bash
bash scripts/dev/scaffold-product-docker.sh --check
```
