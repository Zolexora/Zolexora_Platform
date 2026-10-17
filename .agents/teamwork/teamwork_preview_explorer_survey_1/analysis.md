# In-Depth Survey: Infisical CLI Setup, Authentication Flows & Secrets Management for Zolexora TMS

**Explorer:** Explorer 1 (Infisical & Secrets Specialist)  
**Date:** 2026-10-17  
**Target Product:** Zolexora Transportation Management System (TMS) (`products/zolexora-tms`)  
**Scope:** Read-only survey of Infisical CLI status, installation methods, workspace linking, authentication mechanisms, environment variable requirements, and CLI invocation syntax.

---

## Executive Summary

The Zolexora TMS stack consists of five Docker container services: `tms-postgres`, `tms-backend`, `tms-web`, `tms-admin`, and `tms-nginx`. Runtime secrets management is standardized on **Infisical**, linking the workspace `188824cd-59ce-468f-b60f-f2da7aeefe63` under the secret vault path `/Zolexora_Auth_TMS`.

Currently:
1. The `infisical` CLI is **not installed** in the system PATH.
2. The legacy installation script URL referenced in `scripts/setup/infisical-init.sh` (`https://dl.cloudsmith.io/public/infisical/...`) is **obsolete (HTTP 404)**. The modern official APT repository is hosted at `https://artifacts-cli.infisical.com/setup.deb.sh`, and an alternative NPM package `@infisical/cli` (v0.44.2) is available.
3. TMS is already linked via `products/zolexora-tms/.infisical.json` to project `188824cd-59ce-468f-b60f-f2da7aeefe63`, environment `dev`, path `/Zolexora_Auth_TMS`.
4. Interactive `infisical login` **blocks on stdin**; scripts must use non-interactive status detection (`infisical user get` or `infisical login status`) and provide automated development fallback without committing unencrypted secrets to git.
5. All required environment variables and secrets have been mapped across the five services.

---

## 1. Infisical CLI Installation Status & Non-Destructive Options

### 1.1 Current Environment Inspection
- **Command executed:** `which infisical`
- **Result:** Non-zero exit code (`infisical not found in PATH`).
- **Operating System:** Debian GNU/Linux 12 (bookworm), architecture `x86_64` (Linux kernel 6.6.137+).
- **Runtimes present:** Node.js `v20.20.2`, npm `10.8.2`, Python `3.12`, Docker `28.0.1`, Docker Compose `v2.33.1`.
- **Privileges:** `sudo` is available without password prompt (`sudo -n true` exited 0).

### 1.2 Deprecation in Existing Repository Scripts
In `scripts/setup/infisical-init.sh` (line 17) and `scripts/setup/start.sh` (line 41), the installation command is written as:
```bash
curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.deb.sh' | sudo bash
```
- **Finding:** Testing this URL returns **HTTP/2 404** because Cloudsmith repository distribution was migrated. Running the existing script will fail on fresh systems.

### 1.3 Verified Modern Installation Methods

#### Method A: Official Infisical APT Repository (Recommended)
Verified live endpoint: `https://artifacts-cli.infisical.com/setup.deb.sh` (HTTP 200).
```bash
# Non-destructive system package installation
curl -1sLf 'https://artifacts-cli.infisical.com/setup.deb.sh' | sudo -E bash
sudo apt-get update && sudo apt-get install -y infisical
```
- **Pros:** Native binary installed in `/usr/bin/infisical`, auto-updates via apt, zero NodeJS overhead.
- **Verification:** `infisical --version`

#### Method B: Global NPM Package (Fast & Self-Contained)
The NPM registry provides the official package `@infisical/cli` (v0.44.2 verified):
```bash
npm install -g @infisical/cli
```
- **Note:** The old package name `infisical` was unpublished on 2025-03-17; the scoped package `@infisical/cli` must be used.
- **Verification:** `infisical --version`

#### Method C: Standalone Binary Direct Download (No Package Manager)
Download release tarball directly from GitHub releases:
```bash
INFISICAL_VERSION="0.44.2"
curl -sSL "https://github.com/Infisical/infisical/releases/download/infisical-cli%2Fv${INFISICAL_VERSION}/infisical_${INFISICAL_VERSION}_linux_amd64.tar.gz" | tar -xz -C /tmp
sudo mv /tmp/infisical /usr/local/bin/infisical
sudo chmod +x /usr/local/bin/infisical
```

---

## 2. Infisical Workspace Linkage & Configuration Analysis

### 2.1 File Analysis: `products/zolexora-tms/.infisical.json`
Location: `/workspaces/Zolexora_Platform/products/zolexora-tms/.infisical.json`
```json
{
  "workspaceId": "188824cd-59ce-468f-b60f-f2da7aeefe63",
  "defaultEnvironment": "dev",
  "secretsPath": "/Zolexora_Auth_TMS"
}
```
- **`workspaceId`:** `188824cd-59ce-468f-b60f-f2da7aeefe63` matches the Zolexora Platform project in the Infisical Cloud Vault.
- **`defaultEnvironment`:** `dev` defines the development environment slug.
- **`secretsPath`:** `/Zolexora_Auth_TMS` scopes secret fetching specifically to the Firebase TMS credentials folder.

### 2.2 File Analysis: Root Repository `.infisical.json`
Location: `/workspaces/Zolexora_Platform/.infisical.json`
```json
{
  "workspaceId": "188824cd-59ce-468f-b60f-f2da7aeefe63",
  "defaultEnvironment": "",
  "gitBranchToEnvironmentMapping": null
}
```
- The root repository is linked to the exact same workspace ID (`188824cd-59ce-468f-b60f-f2da7aeefe63`).

### 2.3 Cross-Product Survey
Inspection of all 11 product directories revealed that only `products/zolexora-tms/` has a fully configured, active `workspaceId`. All other products (`zolexora-erp`, `zolexora-ims`, `clarityfi`, etc.) currently have `"workspaceId": ""`. TMS is the pioneer implementation of Infisical workspace linkage in this monorepo.

---

## 3. Authentication Flows, Interactive Traps & Development Fallback

### 3.1 Interactive vs Non-Interactive Behavior
- **`infisical login` (Interactive):** Prompts the terminal user to authenticate via browser OAuth redirect or credential input.
  - **Risk:** In automated execution (subagents, CI/CD, headless dev containers, background tasks), running `infisical login` **blocks indefinitely on standard input**, hanging the startup script.
- **Non-Interactive Authentication Options:**
  1. **Service Token:** Pass via `INFISICAL_TOKEN` environment variable or `--token` flag.
  2. **Universal Auth (Machine Identity):** Set `INFISICAL_CLIENT_ID` and `INFISICAL_CLIENT_SECRET`.

### 3.2 Non-Blocking Authentication Status Verification
Scripts should never run `infisical login` blindly. Instead, check credentials non-interactively using:
```bash
if command -v infisical >/dev/null 2>&1 && { [ -n "$INFISICAL_TOKEN" ] || infisical user get >/dev/null 2>&1 || infisical login status >/dev/null 2>&1; }; then
    USE_INFISICAL=true
else
    USE_INFISICAL=false
fi
```

### 3.3 Development Fallback & Leak Prevention
When Infisical is unauthenticated (e.g. offline dev, fresh clone):
1. **Fallback Sequence:**
   - Check if `products/zolexora-tms/.env` exists.
   - If not, check if `config/envs/zolexora-tms/tms.env.example` exists.
   - For dev mode, generate a local `.env` or run `docker compose` with existing environment variables/defaults.
2. **Git Leak Prevention:**
   - Verified `/workspaces/Zolexora_Platform/.gitignore`:
     - Line 30: `.env`
     - Line 31: `.env.local`
     - Line 36: `*.env`
     - Line 37: `!*.env.example`
     - Line 60: `*.env.keys`
     - Line 63: `config/envs/**/*.env`
   - Verified `/workspaces/Zolexora_Platform/products/zolexora-tms/.gitignore`:
     - Lines 6-10: `.env`, `.env*.local`, `.env.production`, `.env.staging`
     - Lines 42-43: `.env.keys`, `.env.local`
   - **Conclusion:** Any generated `.env` file in `products/zolexora-tms/` is strictly ignored by git, ensuring zero secret leakage.

---

## 4. Stack Environment Variables & Secrets Reference

The canonical compose file is `products/zolexora-tms/compose.yaml`. Here is the complete audit of required environment variables per service, mapped against `config/envs/zolexora-tms/tms.env.example`:

| Service | Container Name | Port(s) | Required / Injected Variables | Purpose & Defaults |
|---|---|---|---|---|
| **postgres** | `tms-postgres` | Host `5448` &rarr; Container `5432` | `POSTGRES_USER`<br>`POSTGRES_PASSWORD`<br>`POSTGRES_DB`<br>`TMS_POSTGRES_PORT` | Local storage engine for TMS. Defaults in compose: `tms`/`password`/`tms`. Host port default: `5448`. Healthcheck: `pg_isready -U tms -d tms`. |
| **backend** | `tms-backend` | Container `4030` | `DATABASE_URL`<br>`FIREBASE_PROJECT_ID`<br>`PORT`<br>`NODE_ENV`<br>`SUPABASE_URL`<br>`SUPABASE_ANON_KEY`<br>`SUPABASE_SERVICE_ROLE_KEY`<br>`JWT_SECRET`<br>`CASHFREE_*`<br>`CLOUDFLARE_R2_*`<br>`RESEND_API_KEY`<br>`REDIS_URL` | FastAPI / Uvicorn backend API. Healthcheck queries `http://localhost:4030/health`. Defaults in `app/core/config.py`: `DATABASE_URL=postgresql://tms:password@postgres:5432/tms`, `PORT=4030`. |
| **tms-web** | `tms-web` | Container `80` | `NEXT_PUBLIC_FIREBASE_ACC1_TMS_API_KEY`<br>`NEXT_PUBLIC_FIREBASE_ACC1_TMS_AUTH_DOMAIN`<br>`NEXT_PUBLIC_FIREBASE_ACC1_TMS_PROJECT_ID`<br>`NEXT_PUBLIC_FIREBASE_ACC1_TMS_STORAGE_BUCKET`<br>`NEXT_PUBLIC_FIREBASE_ACC1_TMS_MESSAGING_SENDER_ID`<br>`NEXT_PUBLIC_FIREBASE_ACC1_TMS_APP_ID` | React/Vite web application built and served via Nginx Alpine. `docker-entrypoint-env.sh` reads all `NEXT_PUBLIC_*` / `VITE_*` vars at runtime and writes `window.__ENV__` in `/usr/share/nginx/html/env-config.js`. Healthcheck: `curl -f http://localhost:80/`. |
| **tms-admin** | `tms-admin` | Container `80` | Same `NEXT_PUBLIC_FIREBASE_ACC1_TMS_*` keys as `tms-web` | React/Vite admin dashboard built and served via Nginx Alpine. Same `docker-entrypoint-env.sh` dynamic config generation. Healthcheck: `curl -f http://localhost:80/`. |
| **nginx** | `tms-nginx` | Host `3084` &rarr; Container `80` | `TMS_PORT` (host port, default: `3084`) | Reverse proxy gateway. Routes `http://localhost:3084/api/` &rarr; `tms-backend:4030`, `http://localhost:3084/` &rarr; `tms-web:80`, `admin.localhost` &rarr; `tms-admin:80`. Healthcheck: `curl -sf http://localhost/ -o /dev/null`. |

---

## 5. Exact CLI Syntax for Running Commands with Secrets Injected

### 5.1 Root Execution (Explicit Workspace, Environment, and Path)
From repository root `/workspaces/Zolexora_Platform`:
```bash
infisical run \
  --projectId=188824cd-59ce-468f-b60f-f2da7aeefe63 \
  --env=dev \
  --path=/Zolexora_Auth_TMS \
  -- docker compose -f products/zolexora-tms/compose.yaml up -d --build
```

### 5.2 Product Directory Execution (Workspace-Linked)
From `products/zolexora-tms/` (where `.infisical.json` resides):
```bash
cd /workspaces/Zolexora_Platform/products/zolexora-tms
infisical run -- docker compose up -d --build
```
*Note: Because `.infisical.json` defines `workspaceId`, `defaultEnvironment: "dev"`, and `secretsPath: "/Zolexora_Auth_TMS"`, Infisical automatically applies these flags.*

### 5.3 Automated Non-Interactive Execution (Machine Token / Universal Auth)
```bash
# Using Infisical Token:
infisical run \
  --token="$INFISICAL_TOKEN" \
  --env=dev \
  --path=/Zolexora_Auth_TMS \
  -- docker compose -f products/zolexora-tms/compose.yaml up -d --build

# Using Universal Auth (Machine Identity):
infisical run \
  --projectId=188824cd-59ce-468f-b60f-f2da7aeefe63 \
  --client-id="$INFISICAL_CLIENT_ID" \
  --client-secret="$INFISICAL_CLIENT_SECRET" \
  --env=dev \
  --path=/Zolexora_Auth_TMS \
  -- docker compose -f products/zolexora-tms/compose.yaml up -d --build
```

### 5.4 Recommended Script Integration Wrapper
To be used in `products/zolexora-tms/scripts/docker-start.sh` and `scripts/setup/start.sh`:
```bash
COMPOSE_FILE="products/zolexora-tms/compose.yaml"

if command -v infisical >/dev/null 2>&1 && { [ -n "$INFISICAL_TOKEN" ] || infisical user get >/dev/null 2>&1 || infisical login status >/dev/null 2>&1; }; then
    echo "🔐 Injecting secrets via Infisical (workspace: 188824cd-59ce-468f-b60f-f2da7aeefe63, path: /Zolexora_Auth_TMS, env: dev)..."
    infisical run --projectId=188824cd-59ce-468f-b60f-f2da7aeefe63 --env=dev --path=/Zolexora_Auth_TMS -- \
        docker compose -f "$COMPOSE_FILE" up -d --build
else
    echo "⚠️  Infisical not authenticated. Starting containers with default development environment..."
    docker compose -f "$COMPOSE_FILE" up -d --build
fi
```

---

## 6. Recommendations for Downstream Milestones

1. **Fix Infisical Installation Command in Repo Scripts:**
   Update `scripts/setup/infisical-init.sh` and `scripts/setup/start.sh` to replace the dead Cloudsmith URL with `https://artifacts-cli.infisical.com/setup.deb.sh` or `npm install -g @infisical/cli`.
2. **Standardize Startup Script Canonical Target:**
   Deprecate `scripts/zolexora-tms/start-docker.sh` (which incorrectly references ERP `.env` and `infrastructure/docker-compose.yml`) in favor of `products/zolexora-tms/scripts/docker-start.sh` pointing to `products/zolexora-tms/compose.yaml`.
3. **Container Health & Ports:**
   Ensure `tms-postgres` on `5448`, `tms-nginx` on `3084`, and backend endpoint `http://localhost:4030/health` respond as required by R3.
