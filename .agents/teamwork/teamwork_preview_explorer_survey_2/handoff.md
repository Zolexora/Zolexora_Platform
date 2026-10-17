# Handoff Report: Startup Scripts & Orchestration Survey

**Agent**: Explorer 2 (Scripts & Orchestration Specialist)  
**Task**: In-depth read-only survey of TMS startup and orchestration scripts  
**Date**: 2026-10-17  
**Working Directory**: `/workspaces/Zolexora_Platform/.agents/teamwork/teamwork_preview_explorer_survey_2`  
**Analysis File**: `/workspaces/Zolexora_Platform/.agents/teamwork/teamwork_preview_explorer_survey_2/analysis.md`

---

## 1. Observation

1. **`scripts/zolexora-tms/start-docker.sh`**:
   - **Line 5**: `cd "$(dirname "$0")/.."` calculates `REPO_ROOT` as `/workspaces/Zolexora_Platform/scripts` rather than the repository root.
   - **Lines 7–28**: Contains legacy Bitwarden unlock logic (`bw unlock --passwordenv BW_MASTER_PASSWORD`, `bw get notes "ZOLEXORA TMS DOTENV_PRIVATE_KEY"`), exiting with code 1 if Bitwarden is unavailable.
   - **Line 31**: Executes `pnpm dotenvx get -f config/envs/zolexora-erp/erp.env ... > .env.docker`, extracting ERP variables and writing plaintext `.env.docker` to disk.
   - **Lines 43, 53, 94**: Targets `docker compose -f infrastructure/docker-compose.yml`. Tool command `view_file` on `/workspaces/Zolexora_Platform/infrastructure/docker-compose.yml` returned error: `stat /workspaces/Zolexora_Platform/infrastructure/docker-compose.yml: no such file or directory`.
   - **Lines 68, 80**: Contains blocking interactive prompt `read -p "Select an option [1]: " OPTION`.
   - **Lines 76–78**: References non-existent compose services `SERVICES="backend redis"`, `SERVICES="tms"`, and `SERVICES="admin"`.

2. **`scripts/setup/start.sh`**:
   - **Lines 30–38**: Uses `if infisical user get >/dev/null 2>&1; then USE_INFISICAL=true`, which succeeds only for interactive user sessions and fails when authenticated via token (`INFISICAL_TOKEN` or machine identity).
   - **Lines 56–66**: Scans `products/*/` and locates `products/zolexora-tms/compose.yaml`.
   - **Lines 116–124**: Calls `infisical run --path="$SECRET_PATH" --env="$ENV_SLUG" -- docker compose -f "$COMPOSE_FILE" up -d --build` without `--projectId="$WORKSPACE_ID"`, relying on root `./.infisical.json`.
   - **Lines 68–76**: Always prompts with `read -rp "Select an option..." OPTION` and ignores CLI arguments.

3. **`products/zolexora-tms/.infisical.json`**:
   - **Lines 1–5**: Verbatim contents:
     ```json
     {
       "workspaceId": "188824cd-59ce-468f-b60f-f2da7aeefe63",
       "defaultEnvironment": "dev",
       "secretsPath": "/Zolexora_Auth_TMS"
     }
     ```

4. **`package.json`**:
   - **Lines 17–19**:
     ```json
     "docker:tms:start": "bash products/zolexora-tms/scripts/docker-start.sh start",
     "docker:tms:restart": "bash products/zolexora-tms/scripts/docker-start.sh restart",
     "docker:tms:stop": "bash products/zolexora-tms/scripts/docker-start.sh stop",
     ```
   - Targets `products/zolexora-tms/scripts/docker-start.sh` instead of `scripts/zolexora-tms/start-docker.sh`.

5. **`products/zolexora-tms/compose.yaml`**:
   - Defines services: `postgres` (port `5448:5432`), `backend` (port `4030` internally, no host port mapped currently), `tms-web` (port `80` internally), `tms-admin` (port `80` internally), `nginx` (port `3084:80`).
   - `tms-web` and `tms-admin` declare pass-through environment keys (`NEXT_PUBLIC_FIREBASE_ACC1_TMS_API_KEY`, etc.). `docker-entrypoint-env.sh` generates `window.__ENV__` in container memory without writing to host disk.

---

## 2. Logic Chain

1. From **Observation 1**, `scripts/zolexora-tms/start-docker.sh` cannot run in its present state: it lands in the wrong directory, fails on missing `infrastructure/docker-compose.yml`, halts on missing Bitwarden credentials, and violates security requirements by writing unencrypted `.env.docker` to disk.
2. From **Observation 1 & 4**, there are two competing startup scripts: `scripts/zolexora-tms/start-docker.sh` and `products/zolexora-tms/scripts/docker-start.sh`. `package.json` references the latter, while monorepo conventions place product scripts in `scripts/zolexora-tms/`. Both must be synchronized.
3. From **Observation 3 & 5**, `products/zolexora-tms/compose.yaml` is the sole canonical compose file for TMS. Secrets must be injected into `docker compose up` at runtime using `infisical run --projectId=188824cd-59ce-468f-b60f-f2da7aeefe63 --env=dev --path=/Zolexora_Auth_TMS`.
4. From **Observation 2 & 1**, interactive `read` calls make automated non-interactive runs (such as subagents or CI) hang or crash. Both scripts require robust argument parsing (`$1` = subcommand / product) and fallback logic checking `[ -t 0 ]`.
5. From **Observation 5**, for Acceptance Criteria R3 (checking `http://localhost:4030/health`), `backend` in `compose.yaml` must expose port `4030:4030` to the host.

---

## 3. Caveats

- The Infisical CLI is currently not installed in the system environment (`infisical: command not found`). The scripts must handle both the installed/authenticated state and graceful unauthenticated fallback.
- No live containers were started or modified during this investigation (strictly read-only per constraints).
- Backend database migrations (`alembic upgrade head`) or database seeding steps were not verified; they depend on `tms-postgres` running.

---

## 4. Conclusion

Acceptance Criteria R2 requires refactoring `scripts/zolexora-tms/start-docker.sh` and updating `scripts/setup/start.sh`:
1. **In `scripts/zolexora-tms/start-docker.sh`**:
   - Fix directory navigation to monorepo root.
   - Remove all Bitwarden and `.env.docker` code.
   - Target canonical file `products/zolexora-tms/compose.yaml`.
   - Wrap container launch with `infisical run --projectId="188824cd-59ce-468f-b60f-f2da7aeefe63" --env="dev" --path="/Zolexora_Auth_TMS" -- docker compose -f products/zolexora-tms/compose.yaml up -d`.
   - Implement CLI subcommands (`start|up`, `stop|down`, `restart`, `build`, `logs`, `status`) and bypass interactive prompts when `[ ! -t 0 ]` or arguments are supplied.
   - Synchronize with `products/zolexora-tms/scripts/docker-start.sh`.
2. **In `scripts/setup/start.sh`**:
   - Update Infisical check to detect `INFISICAL_TOKEN` / `INFISICAL_ACCESS_TOKEN`.
   - Pass `--projectId="$WORKSPACE_ID"` when invoking `infisical run`.
   - Add CLI argument support (`./scripts/setup/start.sh zolexora-tms up`) so it runs non-interactively without prompting.

---

## 5. Verification Method

To verify these findings and the resulting implementation:

1. **Static Syntax & Path Check**:
   ```bash
   bash -n scripts/zolexora-tms/start-docker.sh
   bash -n scripts/setup/start.sh
   bash -n products/zolexora-tms/scripts/docker-start.sh
   ```
2. **Target File Existence**:
   ```bash
   test -f products/zolexora-tms/compose.yaml && echo "Compose file exists"
   test -f products/zolexora-tms/.infisical.json && echo "Infisical config exists"
   ```
3. **Dry-Run Non-Interactive Invocation**:
   ```bash
   # Test status/ps subcommand non-destructively:
   bash scripts/zolexora-tms/start-docker.sh status
   # Test help/usage without blocking:
   bash scripts/zolexora-tms/start-docker.sh --help
   ```
4. **Invalidation Conditions**:
   - If `scripts/zolexora-tms/start-docker.sh` still references `infrastructure/docker-compose.yml`, the report is invalidated.
   - If unencrypted `.env.docker` files are generated on disk, the implementation violates the security constraint.
