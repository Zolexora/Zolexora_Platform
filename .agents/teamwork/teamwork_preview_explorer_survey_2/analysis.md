# In-Depth Survey & Orchestration Analysis: TMS Docker Startup & Infisical Integration

**Date**: 2026-10-17  
**Explorer**: Explorer 2 (Scripts & Orchestration Specialist)  
**Scope**: `scripts/zolexora-tms/start-docker.sh`, `scripts/setup/start.sh`, `products/zolexora-tms/scripts/docker-start.sh`, `package.json`, and monorepo compose files.  
**Objective**: Fulfill Acceptance Criteria R2 — non-destructive startup execution, launching containers using `infisical run`, targeting canonical compose file `products/zolexora-tms/compose.yaml`, and managing container lifecycle seamlessly.

---

## Executive Summary

A comprehensive investigation into the repository's startup scripts, secret management, Docker Compose files, and npm/pnpm package scripts revealed significant legacy debt, path inconsistencies, and unaligned secrets management logic:

1. **`scripts/zolexora-tms/start-docker.sh` is critically broken and outdated**:
   - Computes repository root incorrectly as `cd "$(dirname "$0")/.."`, navigating into `scripts/` rather than the repo root.
   - Relies on deprecated Bitwarden (`bw unlock`) and `dotenvx`, reading from ERP (`config/envs/zolexora-erp/erp.env`) rather than TMS secrets.
   - Writes decrypted plaintext secrets to disk (`.env.docker`), violating the zero-unencrypted-credentials constraint.
   - References non-existent `infrastructure/docker-compose.yml`.
   - Hardcodes obsolete service names (`redis`, `tms`, `admin`).
   - Relies on interactive `read -p` prompts without headless/non-interactive fallback.
2. **`scripts/setup/start.sh` partially implements Infisical but lacks CLI argument support**:
   - Detects `products/zolexora-tms/compose.yaml` dynamically via glob scan.
   - Infisical check only tests `infisical user get`, which fails in headless CI/CD environments where service tokens (`INFISICAL_TOKEN`) are supplied.
   - Does not pass `--projectId` to `infisical run`, potentially causing Infisical to fail when run from repo root.
   - Strictly blocks on interactive `read -rp` prompt, breaking automated agent/CI execution.
3. **Canonical Compose & Script Target**:
   - The single canonical Docker Compose file for TMS is `products/zolexora-tms/compose.yaml`.
   - Root `compose.yaml` is exclusively for ERP (Frappe/MariaDB stack).
   - In `package.json`, scripts call `products/zolexora-tms/scripts/docker-start.sh` (a newer, partially aligned script) rather than `scripts/zolexora-tms/start-docker.sh`. Both scripts must be synchronized to prevent drift.

---

## 1. Script Inspection & Forensic Analysis

### 1.1 `scripts/zolexora-tms/start-docker.sh`

| Aspect | Current Implementation | Defect / Risk | Required Alignment |
|---|---|---|---|
| **Working Directory** | `cd "$(dirname "$0")/.."` (Line 5) | Resolves to `/workspaces/Zolexora_Platform/scripts` instead of monorepo root. All relative paths fail. | Resolve via `REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)" && cd "$REPO_ROOT"`. |
| **Secrets Manager** | Bitwarden CLI (`bw login`, `bw unlock`) + `dotenvx` (Lines 7–28) | Violates ADR 0003 and R1/R2 mandates. If Bitwarden is unavailable, script aborts (`exit 1`). | Replace with Infisical CLI (`infisical run`) with graceful fallback to local env files. |
| **Env File Generation** | `pnpm dotenvx get -f config/envs/zolexora-erp/erp.env ... > .env.docker` (Line 31) | Reads ERP env instead of TMS, and writes decrypted secrets to host filesystem (`.env.docker`). | Remove `.env.docker` generation. Runtime secrets must be injected into container environment in RAM via `infisical run`. |
| **Target Compose File** | `infrastructure/docker-compose.yml` (Lines 43, 53, 94) | File does not exist (`stat: no such file or directory`). Docker Compose fails immediately. | Point to `products/zolexora-tms/compose.yaml`. |
| **Service Names** | `redis`, `tms`, `admin` (Lines 76–78) | Service names do not match compose definitions (`postgres`, `backend`, `tms-web`, `tms-admin`, `nginx`). | Use valid service names from `products/zolexora-tms/compose.yaml`. |
| **Execution Mode** | Blocks on `read -p "Select an option [1]: " OPTION` (Line 68) | Fails in non-interactive / CI / agent execution environments without a TTY (`[ ! -t 0 ]`). | Support CLI arguments (`start`, `stop`, `restart`, `build`, `logs`, `status`, service names) and auto-detect `[ -t 0 ]`. |
| **Reported Ports** | `http://localhost:3000`, `3001`, `4030/docs` (Lines 99–105) | Inaccurate; TMS Web & Admin run behind Nginx gateway on port 3084. Backend health is on port 4030. | Display correct ports: Gateway `http://localhost:3084`, Backend `http://localhost:4030/health`, DB `localhost:5448`. |

### 1.2 `scripts/setup/start.sh`

`scripts/setup/start.sh` is designed as a universal monorepo startup script. It successfully auto-discovers `products/zolexora-tms/compose.yaml` (Lines 56–66), but exhibits the following gaps:

1. **Authentication Check Vulnerability (Lines 30–38)**:
   ```bash
   if command -v infisical >/dev/null 2>&1; then
     if infisical user get >/dev/null 2>&1; then
       USE_INFISICAL=true
   ```
   *Issue*: `infisical user get` checks for an interactive user session. In headless environments (CI/CD, GitHub Actions, Docker, or machines using machine identities), secrets are provided via `INFISICAL_TOKEN` or `INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET`. If `INFISICAL_TOKEN` is exported, `infisical user get` returns non-zero, wrongly deactivating Infisical.
   *Fix*: Check `[ -n "$INFISICAL_TOKEN" ] || [ -n "$INFISICAL_ACCESS_TOKEN" ] || infisical user get >/dev/null 2>&1`.

2. **Missing `workspaceId` / `--projectId` Flag (Lines 116–124)**:
   ```bash
   SECRET_PATH=$(python3 -c "import json; d=json.load(open('$DIR/.infisical.json')); print(d.get('secretsPath','/'))" 2>/dev/null || echo "/")
   ENV_SLUG=$(python3 -c "import json; d=json.load(open('$DIR/.infisical.json')); print(d.get('defaultEnvironment','dev'))" 2>/dev/null || echo "dev")
   infisical run --path="$SECRET_PATH" --env="$ENV_SLUG" -- docker compose -f "$COMPOSE_FILE" up -d --build
   ```
   *Issue*: `products/zolexora-tms/.infisical.json` contains:
   ```json
   {
     "workspaceId": "188824cd-59ce-468f-b60f-f2da7aeefe63",
     "defaultEnvironment": "dev",
     "secretsPath": "/Zolexora_Auth_TMS"
   }
   ```
   When `infisical run` is invoked from `REPO_ROOT`, it reads the root `./.infisical.json` rather than `$DIR/.infisical.json`. While the root file also specifies workspace `188824cd-...`, other product folders will fail. Passing `--projectId="$WORKSPACE_ID"` guarantees explicit targeting.

3. **No CLI Argument / Headless Support (Line 76)**:
   *Issue*: `read -rp "Select an option..." OPTION` always prompts for user input. If passed `./scripts/setup/start.sh zolexora-tms up`, it ignores `$1` and stalls on `read`.
   *Fix*: Allow positional parameters (e.g. `$1` = product name/substring, `$2` = action).

### 1.3 `products/zolexora-tms/scripts/docker-start.sh`

Located directly inside the product folder, this script already targets `products/zolexora-tms/compose.yaml` and supports basic non-interactive actions (`start`, `stop`, `restart`, `logs`, `status`). However:
- Uses `infisical login status >/dev/null 2>&1` (line 14), which is not a valid subcommand of Infisical CLI.
- Does not extract `workspaceId` / `--projectId`.
- Lacks individual service selection or build options.
- Creates divergence: `package.json` references this file, whereas repository documentation and `scripts/zolexora-tms/` point to `scripts/zolexora-tms/start-docker.sh`.

---

## 2. Compose File Landscape & Canonical Targeting

A recursive scan across the entire workspace identified 15 compose files. The relevant candidates:

| Compose File | Status | Assessment |
|---|---|---|
| `/workspaces/Zolexora_Platform/products/zolexora-tms/compose.yaml` | **Canonical** | Contains complete TMS stack: `postgres`, `backend`, `tms-web`, `tms-admin`, `nginx`. |
| `/workspaces/Zolexora_Platform/compose.yaml` | Non-target | Root compose file dedicated to Frappe/ERP stack (`mariadb`, `redis`, etc.). |
| `/workspaces/Zolexora_Platform/infrastructure/docker-compose.yml` | Non-existent | Referenced by legacy script; file does not exist. |

### Canonical Compose File Architecture (`products/zolexora-tms/compose.yaml`)

```
               ┌────────────────────────────────────────────────────────┐
               │              tms-nginx (Port 3084:80)                  │
               └──────────────┬──────────────────────────┬──────────────┘
                              │                          │
              Host: localhost / app.localhost   Host: admin.localhost
                              │                          │
                              ▼                          ▼
               ┌───────────────────────┐  ┌─────────────────────────┐
               │  tms-web (Port 80)    │  │  tms-admin (Port 80)    │
               │  Nginx + SPA dist     │  │  Nginx + SPA dist       │
               └───────────────────────┘  └─────────────────────────┘
                              │                          │
                              │ API proxy: /api/ -> :4030│
                              ▼                          ▼
               ┌────────────────────────────────────────────────────────┐
               │            tms-backend (FastAPI, Port 4030)            │
               └──────────────────────────┬─────────────────────────────┘
                                          │
                                          ▼
               ┌────────────────────────────────────────────────────────┐
               │           tms-postgres (Postgres 15, Port 5448)        │
               └────────────────────────────────────────────────────────┘
```

**Key Orchestration Dependencies**:
- **Backend Host Port Exposure**: In `products/zolexora-tms/compose.yaml`, `backend` currently lacks a host port binding. For `http://localhost:4030/health` to be reachable directly on the host (as required by Acceptance Criteria R3), `backend` must map `"${TMS_BACKEND_PORT:-4030}:4030"`.
- **Secret Injection**:
  - `tms-web` and `tms-admin` declare pass-through environment keys:
    `NEXT_PUBLIC_FIREBASE_ACC1_TMS_API_KEY`, etc.
  - When `infisical run` executes `docker compose up`, Docker Compose injects these variables into the container environment.
  - Inside the container, `products/zolexora-tms/docker-entrypoint-env.sh` generates `window.__ENV__` in container RAM (`/usr/share/nginx/html/env-config.js`).
  - No secret is ever written to the host filesystem.

---

## 3. Detailed Infisical Integration Architecture

### 3.1 Metadata Specification
`products/zolexora-tms/.infisical.json`:
- `workspaceId`: `188824cd-59ce-468f-b60f-f2da7aeefe63`
- `defaultEnvironment`: `dev`
- `secretsPath`: `/Zolexora_Auth_TMS`

### 3.2 Execution Wrapping Pattern
The non-destructive execution wrapper:
```bash
infisical run \
  --projectId="188824cd-59ce-468f-b60f-f2da7aeefe63" \
  --env="dev" \
  --path="/Zolexora_Auth_TMS" \
  -- docker compose -f products/zolexora-tms/compose.yaml up -d
```

### 3.3 Authentication Hierarchy & Fallback
The startup script should evaluate secrets injection in order:
1. **Interactive Session**: `infisical user get` succeeds -> inject via `infisical run`.
2. **Machine Identity / Token**: `INFISICAL_TOKEN` or `INFISICAL_ACCESS_TOKEN` is set -> inject via `infisical run`.
3. **Unauthenticated Infisical CLI**: If `infisical` is installed but unauthenticated:
   - Print clear, actionable notice: `Run 'infisical login' or set INFISICAL_TOKEN`.
   - Fall back to launching containers with existing host environment or `products/zolexora-tms/.env` (if present) non-destructively.
4. **Infisical CLI Not Installed**:
   - Print installation command: `curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.deb.sh' | sudo bash && sudo apt-get install -y infisical`.
   - Fall back to standard compose invocation.

---

## 4. Edge Cases & Resilience Strategy

### 4.1 Interactive vs. Non-Interactive (Headless) Execution
- **Hazard**: Using `read -p` in automated workflows blocks indefinitely or triggers EOF syntax errors.
- **Resolution**:
  - Test terminal availability using `[ -t 0 ]`.
  - Prioritize CLI arguments (`$1`, `$2`, etc.) over interactive menus.
  - If no CLI arguments are supplied and `[ ! -t 0 ]` (headless), default to `start` for all services non-interactively.
  - Only show interactive menus when `[ -t 0 ]` AND no arguments were passed.

### 4.2 Containers Already Running (Idempotence)
- **Hazard**: Running `docker compose up` repeatedly might trigger unwanted rebuilds or port clashes.
- **Resolution**:
  - `docker compose up -d` without `--build` is natively idempotent in Docker: containers with identical configurations remain running uninterrupted.
  - Separate `start`/`up` (non-destructive, reuse built images) from `build` / `restart`.
  - Provide a `status` command that checks running containers via `docker compose -f products/zolexora-tms/compose.yaml ps`.

### 4.3 Clean Restart & Volume Preservation
- **Hazard**: Using `docker compose down -v` would destroy `postgres_data`, wiping the local database.
- **Resolution**:
  - `down` and `restart` MUST run `docker compose down` WITHOUT the `-v` flag to preserve named volume `postgres_data`.
  - Provide an explicit warning if volume pruning is ever requested.

### 4.4 Logging & Service Isolation
- **Hazard**: Running `docker compose logs -f` without arguments dumps unmanageable output from all 5 services simultaneously.
- **Resolution**:
  - Support service-scoped logs: `./start-docker.sh logs [backend|postgres|nginx|tms-web|tms-admin]`.
  - Use `set -eo pipefail` for fail-fast error detection while properly catching and displaying meaningful diagnostics.

---

## 5. Exact Script Changes Required (Action Plan for Implementation)

### 5.1 Plan for `scripts/zolexora-tms/start-docker.sh`
Complete refactoring into a unified, robust orchestration script:
1. Set repository root:
   ```bash
   REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
   cd "$REPO_ROOT"
   ```
2. Define configuration constants:
   ```bash
   COMPOSE_FILE="products/zolexora-tms/compose.yaml"
   INFISICAL_CONFIG="products/zolexora-tms/.infisical.json"
   ```
3. Read Infisical configuration safely:
   ```bash
   WORKSPACE_ID="188824cd-59ce-468f-b60f-f2da7aeefe63"
   ENV_SLUG="dev"
   SECRET_PATH="/Zolexora_Auth_TMS"
   if [ -f "$INFISICAL_CONFIG" ]; then
     WORKSPACE_ID=$(python3 -c "import json; d=json.load(open('$INFISICAL_CONFIG')); print(d.get('workspaceId',''))" 2>/dev/null || echo "$WORKSPACE_ID")
     ENV_SLUG=$(python3 -c "import json; d=json.load(open('$INFISICAL_CONFIG')); print(d.get('defaultEnvironment','dev'))" 2>/dev/null || echo "$ENV_SLUG")
     SECRET_PATH=$(python3 -c "import json; d=json.load(open('$INFISICAL_CONFIG')); print(d.get('secretsPath','/'))" 2>/dev/null || echo "$SECRET_PATH")
   fi
   ```
4. Authenticate & wrap Docker Compose:
   ```bash
   USE_INFISICAL=false
   if command -v infisical >/dev/null 2>&1; then
     if [ -n "$INFISICAL_TOKEN" ] || [ -n "$INFISICAL_ACCESS_TOKEN" ] || infisical user get >/dev/null 2>&1; then
       USE_INFISICAL=true
     fi
   fi

   run_compose() {
     if [ "$USE_INFISICAL" = true ]; then
       local flags=()
       [ -n "$WORKSPACE_ID" ] && flags+=(--projectId="$WORKSPACE_ID")
       flags+=(--env="$ENV_SLUG" --path="$SECRET_PATH")
       infisical run "${flags[@]}" -- docker compose -f "$COMPOSE_FILE" "$@"
     else
       docker compose -f "$COMPOSE_FILE" "$@"
     fi
   }
   ```
5. Implement subcommand routing (`start|up`, `stop|down`, `restart`, `build`, `logs`, `status|ps`).
6. Delegate `products/zolexora-tms/scripts/docker-start.sh` to call `scripts/zolexora-tms/start-docker.sh "$@"` (or ensure identical implementations) so both entry points behave identically.

### 5.2 Plan for `scripts/setup/start.sh`
1. Update Infisical check to include token authentication:
   ```bash
   if [ -n "$INFISICAL_TOKEN" ] || [ -n "$INFISICAL_ACCESS_TOKEN" ] || infisical user get >/dev/null 2>&1; then
   ```
2. Extract `workspaceId` and supply `--projectId`:
   ```bash
   WORKSPACE_ID=$(python3 -c "import json; d=json.load(open('$DIR/.infisical.json')); print(d.get('workspaceId',''))" 2>/dev/null || echo "")
   PROJECT_FLAG=""
   [ -n "$WORKSPACE_ID" ] && PROJECT_FLAG="--projectId=$WORKSPACE_ID"
   infisical run $PROJECT_FLAG --path="$SECRET_PATH" --env="$ENV_SLUG" -- docker compose -f "$COMPOSE_FILE" up -d --build
   ```
3. Add CLI argument support so `./scripts/setup/start.sh zolexora-tms` or `./scripts/setup/start.sh zolexora-tms down` runs non-interactively.

---

## 6. Synthesis & Recommended Next Steps

1. **Implementer Action (Sprint Execution)**:
   - Refactor `scripts/zolexora-tms/start-docker.sh` and update `scripts/setup/start.sh` with the verified implementations detailed in Section 5.
   - Synchronize `products/zolexora-tms/scripts/docker-start.sh` and root `package.json` scripts.
2. **Docker Compose & Health Alignment (Coordinate with Explorer 1)**:
   - Ensure `backend` in `products/zolexora-tms/compose.yaml` has `ports: - "${TMS_BACKEND_PORT:-4030}:4030"` exposed to satisfy HTTP 200 health check verification on `http://localhost:4030/health`.
   - Verify Nginx gateway routes correctly on port 3084.
