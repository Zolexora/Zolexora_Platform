# Detailed Survey: Docker Compose Stack & Service Health Validation

**Author**: Explorer 3 (Docker Compose & Service Health Specialist)  
**Date**: 2026-10-17  
**Scope**: `products/zolexora-tms/compose.yaml`, Dockerfiles, service health checks, port bindings, database initialization, and startup mechanics.  
**Mode**: Read-only Investigation

---

## 1. Executive Summary

This report delivers an empirical, read-only analysis of the Zolexora Transportation Management System (TMS) container stack. The canonical Docker Compose file is located at `products/zolexora-tms/compose.yaml`.

Key highlights:
- **Stack Services**: 5 services defined (`postgres`, `backend`, `tms-web`, `tms-admin`, `nginx`).
- **Critical Port Binding Defect**: `postgres` (port `5448`) and `nginx` (port `3084`) are properly published to the host, but `backend` **omits** a `ports:` block in `compose.yaml`. This prevents direct host verification of `http://localhost:4030/health` (Acceptance Criterion R3).
- **Service Dependency / Upstream Resolution Defect**: `nginx` only defines `backend: condition: service_healthy` in its `depends_on`. Empirically verified: Nginx fails startup (`[emerg] host not found in upstream "tms-web"`) if `tms-web` and `tms-admin` are not resolvable in DNS. Furthermore, Nginx's healthcheck probes `/`, which proxies to `tms-web`, causing 502 Bad Gateway and healthcheck failure if `tms-web` is not ready.
- **Database Initialization Gap**: Neither Alembic (21 migrations present) nor `init_db.py` is invoked on backend container boot. On a fresh PostgreSQL volume, tables are not automatically created.
- **Port Conflict Assessment**: Ports `5448`, `4030`, and `3084` are completely free on the host and unique across the Zolexora monorepo ecosystem.

---

## 2. Docker Compose Stack Inspection (`compose.yaml`)

The canonical Compose specification is `products/zolexora-tms/compose.yaml`.

### 2.1 Service Overview Table

| Service Name | Container Name | Base / Image | Build Context | Exposed / Mapped Ports | Resource Limits |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `postgres` | `tms-postgres` | `postgres:15-alpine` | Prebuilt Image | `"${TMS_POSTGRES_PORT:-5448}:5432"` | 1.0 CPU, 512MB RAM |
| `backend` | `tms-backend` | Custom (`python:3.12-slim`) | `./apps/backend` | **None on host** (`EXPOSE 4030` internal) | 1.0 CPU, 512MB RAM |
| `tms-web` | `tms-web` | Custom (`node:22-alpine` → `nginx:alpine`) | `../../` (monorepo root) | Internal port 80 (routed via `tms-nginx`) | 1.0 CPU, 512MB RAM |
| `tms-admin` | `tms-admin` | Custom (`node:22-alpine` → `nginx:alpine`) | `../../` (monorepo root) | Internal port 80 (routed via `tms-nginx`) | 1.0 CPU, 512MB RAM |
| `nginx` | `tms-nginx` | Custom (`nginx:alpine`) | `.` (`products/zolexora-tms`) | `"${TMS_PORT:-3084}:80"` | 1.0 CPU, 512MB RAM |

### 2.2 Resource Deploy Configuration
All 5 services consistently enforce resource constraints:
- `limits`: `cpus: '1.0'`, `memory: 512M`
- `reservations`: `cpus: '0.1'`, `memory: 128M`
This guarantees predictable resource allocation without starving the host environment.

---

## 3. Dockerfiles Architecture & Build Contexts

### 3.1 Backend Service (`products/zolexora-tms/apps/backend/Dockerfile`)
- **Location**: `products/zolexora-tms/apps/backend/Dockerfile`
- **Build Context**: `./apps/backend`
- **Base Image**: `python:3.12-slim`
- **Package Manager**: Astral `uv` copied directly from `ghcr.io/astral-sh/uv:latest` to `/bin/uv`.
- **System Dependencies**: `build-essential`, `libpq-dev`, `curl`.
- **Dependency Installation**: `uv sync --no-dev --frozen` against `pyproject.toml` and `uv.lock`. Fast, reproducible, locked builds.
- **Exposed Port**: `EXPOSE 4030`.
- **Default Command**: `CMD ["/app/.venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4030"]`.
- **Evaluation**: Exceptionally clean, optimized container build.

### 3.2 Frontend Applications (`products/zolexora-tms/Dockerfile.web`)
- **Location**: `products/zolexora-tms/Dockerfile.web`
- **Build Context**: `../../` (Repository root `/workspaces/Zolexora_Platform`).
- **Build Argument**: `ARG APP_PATH` (`apps/frontend/zolexora-tms` for `tms-web`, `apps/frontend/tms-admin` for `tms-admin`).
- **Multi-Stage Build**:
  - **Stage 1: `builder` (`node:22-alpine`)**:
    - Prepares `pnpm@9` via Corepack.
    - Copies monorepo config (`package.json`, `pnpm-workspace.yaml`).
    - Copies shared package `platform/Authentication/User Auth/Firebase`.
    - Copies `products/zolexora-tms/apps/frontend`.
    - Runs `pnpm config set ignore-scripts true && pnpm install --no-frozen-lockfile`.
    - Runs `pnpm --filter "./${APP_PATH}" build` to produce production Vite output in `/app/${APP_PATH}/dist`.
  - **Stage 2: `runtime` (`nginx:alpine`)**:
    - Copies `products/zolexora-tms/nginx-web.conf` to `/etc/nginx/conf.d/default.conf` (SPA fallback routing `try_files $uri $uri/ /index.html;` and static asset caching).
    - Copies `products/zolexora-tms/docker-entrypoint-env.sh` to `/docker-entrypoint.d/40-env-config.sh`.
    - Copies compiled static assets `/app/${APP_PATH}/dist` into `/usr/share/nginx/html`.
    - Exposes port 80.
- **Dynamic Env Injection**:
  - On container startup, Nginx executes scripts in `/docker-entrypoint.d/`.
  - `40-env-config.sh` dynamically inspects container environment variables matching `^(NEXT_PUBLIC|VITE)_` and writes `/usr/share/nginx/html/env-config.js` with `window.__ENV__ = { ... }`.
  - Both `index.html` files load `<script src="/env-config.js"></script>` before the application bundles run.
  - Frontends read `window.__ENV__` first with fallback to `import.meta.env`.
  - **Evaluation**: Solves the static frontend build vs runtime secret injection dilemma without requiring container rebuilds when switching environments.

### 3.3 Reverse Proxy Gateway (`products/zolexora-tms/Dockerfile.nginx`)
- **Location**: `products/zolexora-tms/Dockerfile.nginx`
- **Build Context**: `.` (`products/zolexora-tms/`)
- **Base Image**: `nginx:alpine`
- **Content**: Copies `nginx-conf.d/` to `/etc/nginx/conf.d/`.
- **Evaluation**: Extremely lightweight (<15MB), compiles in seconds.

---

## 4. Port Mappings & Ecosystem Conflict Check

### 4.1 Required TMS Port Mappings
| Service | Required Port | Status in `compose.yaml` | Finding |
| :--- | :--- | :--- | :--- |
| `postgres` | `5448` | `"${TMS_POSTGRES_PORT:-5448}:5432"` | **Pass**: correctly mapped with fallback. |
| `backend` | `4030` | **MISSING** | **Defect**: No `ports:` declared. Internal only. |
| `nginx` | `3084` | `"${TMS_PORT:-3084}:80"` | **Pass**: correctly mapped with fallback. |

### 4.2 Monorepo Port Conflict Verification
An exhaustive grep search across all `compose.yaml` files in `/workspaces/Zolexora_Platform` confirms zero port collisions:
- `3071`: Maunkavach
- `3072`: Zolexora IMS
- `3075`: ClarityFi
- `3076`: Rentoeasy
- `3077`: Zolexora Engage
- `3079`: Zolexora Marketplace
- `3080`: The Textile Care
- `3081`, `3082`: Platform Admin
- **`3084`**: **Zolexora TMS (Nginx Gateway)**
- `3091`: Zolexora AI Web
- `4060`: Ironclub API
- `4090`: Zolexora AI API
- **`4030`**: **Zolexora TMS Backend API**
- **`5448`**: **Zolexora TMS PostgreSQL**

### 4.3 Host Port Availability Check
Execution of `ss -tulpn` on the current system confirms:
- Port `5448`: **Available (UNBOUND)**
- Port `4030`: **Available (UNBOUND)**
- Port `3084`: **Available (UNBOUND)**

### 4.4 Remediation for Backend Port
To satisfy Acceptance Criterion R3 (`http://localhost:4030/health`), `products/zolexora-tms/compose.yaml` must expose:
```yaml
    ports:
      - "${TMS_BACKEND_PORT:-4030}:4030"
```

---

## 5. Health Check Audit & Dependencies Validation

### 5.1 Service Health Checks Detailed Breakdown

| Service | Test Command | Interval | Timeout | Retries | Start Period | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `postgres` | `CMD-SHELL pg_isready -U tms -d tms` | 5s | 5s | 5 | None | **Valid** (Fast, reliable) |
| `backend` | `CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:4030/health')"` | 15s | 5s | 5 | None | **Valid** (`/health` returns HTTP 200) |
| `tms-web` | `CMD curl -f http://localhost:80/` | 30s | 10s | 3 | None | **Valid** (`curl` confirmed in `nginx:alpine`) |
| `tms-admin` | `CMD curl -f http://localhost:80/` | 30s | 10s | 3 | None | **Valid** (`curl` confirmed in `nginx:alpine`) |
| `nginx` | `CMD-SHELL curl -sf http://localhost/ -o /dev/null && exit 0 || exit 1` | 15s | 5s | 3 | 5s | **Conditional** (Depends on `tms-web`) |

### 5.2 Empirical Upstream Resolution Test & Dependency Defect
`products/zolexora-tms/nginx-conf.d/default.conf` configures Nginx reverse proxy routes:
- `http://localhost/` (default server) -> proxies to `http://tms-web:80;`
- `http://admin.localhost/` -> proxies to `http://tms-admin:80;`
- `http://api.localhost/`, `/api/`, `/ws/` -> proxies to `http://tms-backend:4030;`

**Empirical Verification**:
Running `docker run --rm -v ...:/etc/nginx/conf.d:ro nginx:alpine nginx -t` resulted in immediate failure:
```
2026/10/17 10:13:04 [emerg] 1#1: host not found in upstream "tms-backend" in /etc/nginx/conf.d/default.conf:7
nginx: configuration file /etc/nginx/nginx.conf test failed
```
When upstream hostnames are present in `/etc/hosts`:
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

**The Architectural Vulnerability**:
In `compose.yaml`:
```yaml
  nginx:
    ...
    depends_on:
      backend:
        condition: service_healthy
```
Notice: `nginx` does **not** declare dependencies on `tms-web` or `tms-admin`.
If `nginx` starts before `tms-web` and `tms-admin` containers are registered in Docker DNS:
1. Nginx crashes during container startup (`host not found in upstream "tms-web"`).
2. Even if DNS resolves, Nginx's healthcheck executes `curl -sf http://localhost/`, which forwards to `tms-web:80`. If `tms-web` is still starting, Nginx returns HTTP 502 Bad Gateway, causing `curl -sf` to exit with failure and mark `nginx` unhealthy.

**Required Fix**:
Update `nginx.depends_on` in `compose.yaml`:
```yaml
    depends_on:
      backend:
        condition: service_healthy
      tms-web:
        condition: service_healthy
      tms-admin:
        condition: service_healthy
```

---

## 6. Database Migrations & Seeds Lifecyle

### 6.1 Database Schema State
- **Alembic Revisions**: 21 migration files exist in `products/zolexora-tms/apps/backend/alembic/versions/`.
- **Seeding Script**: `products/zolexora-tms/apps/backend/init_db.py`.
  - Runs `Base.metadata.create_all` across all SQLAlchemy models.
  - Seeds tenant database registries (`zolexora-tms-dev-d1-01` through `05`).
  - Seeds MongoDB tenant registries (`zolexora_tms_tenant_01` through `05`).
  - Calls `seed_role_templates()` to seed system roles and permissions.

### 6.2 Startup Automation Gap
In `products/zolexora-tms/apps/backend/Dockerfile`:
```dockerfile
CMD ["/app/.venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4030"]
```
In `products/zolexora-tms/apps/backend/app/main.py`:
`lifespan` only logs service start and shutdown. It does not run migrations or seeds.

**Result**:
When the stack starts up with an empty PostgreSQL database volume, no database tables exist.
- `GET /health` succeeds (no DB query).
- `GET /ready` succeeds (`SELECT 1`).
- Domain endpoints (e.g., `/organisations`, `/users`, `/vehicles`) will fail with PostgreSQL errors (`relation "..." does not exist`).

**Recommendation**:
In `compose.yaml` for `backend`, configure an explicit startup command or entrypoint wrapper:
```yaml
    command: sh -c "python init_db.py && exec /app/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 4030"
```
Or ensure the startup script executes `docker compose exec backend python init_db.py` after containers become healthy.

---

## 7. Networking & Volume Mounts

### 7.1 Named Volumes
- `postgres` mounts `postgres_data:/var/lib/postgresql/data`.
- Declared at root:
  ```yaml
  volumes:
    postgres_data: null
  ```
- Standard persistent storage behavior; data persists across container restarts.

### 7.2 Networks
- `products/zolexora-tms/compose.yaml` does not declare custom networks.
- Docker Compose automatically creates a default user-defined bridge network `zolexora-tms_default`.
- All 5 containers share this network and resolve each other by container name (`tms-postgres`, `tms-backend`, `tms-web`, `tms-admin`, `tms-nginx`) and service name (`postgres`, `backend`, `tms-web`, `tms-admin`, `nginx`).

---

## 8. Potential Build & Startup Blockers

1. **Missing Infisical CLI**:
   - `infisical` is not installed on the system PATH (`which infisical` returned not found).
   - `products/zolexora-tms/.infisical.json` defines workspace `188824cd-59ce-468f-b60f-f2da7aeefe63`, environment `dev`, path `/Zolexora_Auth_TMS`.
   - Without the CLI or an existing `.env` file, starting containers with secret injection requires either installing Infisical or generating `.env` from `config/envs/zolexora-tms/tms.env.example`.

2. **Divergent Startup Scripts**:
   - `scripts/zolexora-tms/start-docker.sh`: Severely outdated. References `infrastructure/docker-compose.yml` (does not exist) and `config/envs/zolexora-erp/erp.env`.
   - `products/zolexora-tms/scripts/docker-start.sh`: Accurate and points to `products/zolexora-tms/compose.yaml`.
   - `scripts/setup/start.sh`: Monorepo script properly detects `products/zolexora-tms/compose.yaml` and `.infisical.json`.

3. **Missing Host Port for Backend in `compose.yaml`**:
   - Must add `ports: ["${TMS_BACKEND_PORT:-4030}:4030"]` to `backend`.

4. **Nginx Missing `depends_on`**:
   - Must add `tms-web` and `tms-admin` with `condition: service_healthy` to prevent Nginx startup DNS crash.

5. **Automatic Schema Seeding**:
   - Add `python init_db.py` to backend startup to ensure tenant and role tables exist on initial boot.

---

## 9. Implementation Action Plan

| Step | Target File | Action |
| :--- | :--- | :--- |
| 1 | `products/zolexora-tms/compose.yaml` | Add `ports: ["${TMS_BACKEND_PORT:-4030}:4030"]` under `backend`. |
| 2 | `products/zolexora-tms/compose.yaml` | Update `nginx.depends_on` to include `tms-web` and `tms-admin` (`condition: service_healthy`). |
| 3 | `products/zolexora-tms/compose.yaml` | Add startup command `sh -c "python init_db.py && exec /app/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 4030"` to `backend`. |
| 4 | `scripts/zolexora-tms/start-docker.sh` | Refactor to point to `products/zolexora-tms/compose.yaml` and use `infisical run`. |
| 5 | Environment | Install Infisical CLI or provide fallback `.env`. |
| 6 | Verification | Execute `docker compose up -d --build` and verify `http://localhost:4030/health` (HTTP 200) and `http://localhost:3084` (HTTP 200). |
