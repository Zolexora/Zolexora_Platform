# Zolexora TMS — Database Change & Migration Runbook

Checklist and exact commands to run whenever you **switch, provision, reset, or modify the schema of** a PostgreSQL database for Zolexora TMS (`apps/platform-core/zolexora-tms`).

---

## 1. Infisical Keys & URL Precedence

All database settings live in Infisical under project `Zolexora_Platform` (`c4ac7d07-f26f-4fb8-bd04-6d3e037079f9`), path `/Zolexora_TMS` (`Database/Postgres_Database`).

> **Critical Precedence Rule** ([config.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/core/config.py#L60-L80)):
> The backend resolves `DATABASE_URL` in this exact order (first non-empty wins):
> 1. `DATABASE_URL`
> 2. `DATABASE_ZOLEXORA_TMS_EXTERNAL_DATABASE_URL`
> 3. `DATABASE_ZOLEXORA_TMS_HOST` + `DATABASE_ZOLEXORA_TMS_PORT` + `DATABASE_ZOLEXORA_TMS_NAME` + `DATABASE_ZOLEXORA_TMS_USER` + `DATABASE_ZOLEXORA_TMS_PASSWORD`
> 4. `DATABASE_ZOLEXORA_TMS_INTERNAL_DATABASE_URL`
>
> **Gotcha:** If `DATABASE_URL` or `DATABASE_ZOLEXORA_TMS_EXTERNAL_DATABASE_URL` is still set in Infisical, updating `DATABASE_ZOLEXORA_TMS_HOST` alone will have **no effect**. Make sure unused override keys are cleared or updated together.

- **SSL behavior** ([session.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/db/session.py#L10-L11), [alembic/env.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/alembic/env.py#L48-L58)):
  - Remote hosts automatically use `ssl="require"`.
  - `localhost` and `127.0.0.1` connect without SSL.
- **Port rule** ([docs/ports.md](file:///workspaces/Zolexora_Platform/docs/ports.md)): If running a local Postgres container, never bind host port `5432` (use `54XX:5432`).

---

## 2. Switching to a New or Reset Database (Exact Steps)

All commands below must be run from the **monorepo root** (`/workspaces/Zolexora_Platform`). Replace `INFISICAL_ENV=dev` with `staging` or `prod` when targeting another environment.

### Step 1: Verify Which Database Infisical Points To & Test Connectivity

```bash
INFISICAL_ENV=dev bash scripts/setup/with-infisical.sh apps/platform-core/zolexora-tms \
  /workspaces/Zolexora_Platform/.venv/bin/python -c "
import asyncio, asyncpg
from app.core.config import settings
async def main():
    print('Host:', settings.DATABASE_ZOLEXORA_TMS_HOST, 'DB:', settings.DATABASE_ZOLEXORA_TMS_NAME)
    ssl = 'require' if ('localhost' not in settings.DATABASE_URL and '127.0.0.1' not in settings.DATABASE_URL) else None
    conn = await asyncpg.connect(settings.DATABASE_URL, ssl=ssl, timeout=15)
    print('Connected OK, SELECT 1 =', await conn.fetchval('SELECT 1'))
    tables = await conn.fetch(\"SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename\")
    print('Existing public tables:', len(tables))
    await conn.close()
asyncio.run(main())
"
```

### Step 2: Apply All Alembic Migrations (Schema + RLS Policies)

> **Never use `init_db.py` (`Base.metadata.create_all`) as a replacement for Alembic.** `create_all` does not create `alembic_version`, PostgreSQL RLS helper functions (`current_app_organisation_id()`, `is_app_bypass_rls()`), or `FORCE ROW LEVEL SECURITY` policies.

```bash
INFISICAL_ENV=dev bash scripts/setup/with-infisical.sh apps/platform-core/zolexora-tms \
  bash -c 'cd apps/platform-core/zolexora-tms/services/backend && /workspaces/Zolexora_Platform/.venv/bin/python -m alembic upgrade head'
```

*(If running inside Docker or using the service-local venv, replace `/workspaces/Zolexora_Platform/.venv/bin/python` with `.venv/bin/python`.)*

### Step 3: Seed Platform Role Templates

```bash
INFISICAL_ENV=dev bash scripts/setup/with-infisical.sh apps/platform-core/zolexora-tms \
  bash -c 'cd apps/platform-core/zolexora-tms/services/backend && /workspaces/Zolexora_Platform/.venv/bin/python -m app.modules.identity.roles.seed_platform_templates'
```

*(Idempotent — skips templates that already exist. `main.py` lifespan also verifies this on API startup.)*

### Step 4: Verify Schema, Alembic Head, and Live RLS Enforcement

```bash
# 1. Confirm current Alembic revision matches head
INFISICAL_ENV=dev bash scripts/setup/with-infisical.sh apps/platform-core/zolexora-tms \
  bash -c 'cd apps/platform-core/zolexora-tms/services/backend && /workspaces/Zolexora_Platform/.venv/bin/python -m alembic current && /workspaces/Zolexora_Platform/.venv/bin/python -m alembic heads'

# 2. Run Postgres RLS + Auth hardening tests
INFISICAL_ENV=dev bash scripts/setup/with-infisical.sh apps/platform-core/zolexora-tms \
  /workspaces/Zolexora_Platform/.venv/bin/pytest \
  apps/platform-core/zolexora-tms/services/backend/tests/test_postgres_rls.py \
  apps/platform-core/zolexora-tms/services/backend/tests/test_auth_service.py \
  apps/platform-core/zolexora-tms/services/backend/tests/test_auth_hardening.py -v
```

### Step 5: Restart Services & Check `/ready`

1. Restart local dev (`Ctrl+C` then `pnpm start:tms`) or Docker (`pnpm docker:tms:restart`).
2. Verify backend DB readiness:
   ```bash
   curl -i http://127.0.0.1:4031/ready
   # Expected: {"status":"ready","service":"zolexora-tms-api","database":"ok"}
   ```

---

## 3. Optional: Copying Data From an Old Database (`pg_dump` / `pg_restore`)

If you are migrating existing data (not starting fresh):

1. **Take a backup of the source DB** (run via `with-infisical.sh` pointing to the source env):
   ```bash
   pg_dump --format=custom --no-owner --no-privileges --dbname="$SOURCE_DATABASE_URL" -f tms_backup.dump
   ```
2. **Restore into the target DB**:
   ```bash
   pg_restore --no-owner --no-privileges --clean --if-exists --dbname="$TARGET_DATABASE_URL" tms_backup.dump
   ```
3. **Run `alembic upgrade head`** on the target DB (Step 2 above) and **verify RLS** (Step 4 above).
4. **Never commit `.dump` or `.sql` backup files** to git, and delete temporary dump files once verified.

---

## 4. When Modifying Models / Creating a New Migration

1. Ensure new SQLAlchemy models are imported in [app/db/models.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/db/models.py) so Alembic autogenerate detects them.
2. Generate the migration:
   ```bash
   INFISICAL_ENV=dev bash scripts/setup/with-infisical.sh apps/platform-core/zolexora-tms \
     bash -c 'cd apps/platform-core/zolexora-tms/services/backend && /workspaces/Zolexora_Platform/.venv/bin/python -m alembic revision --autogenerate -m "describe_change"'
   ```
3. **RLS Checklist for Any New Multi-Tenant Table**:
   - Migration [e10000000001_enable_tenant_row_level_security.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/alembic/versions/e10000000001_enable_tenant_row_level_security.py) only enabled RLS on tables that existed at that revision.
   - If your new migration creates a table with an `organisation_id` column, add `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, and `tenant_isolation_policy` in that same migration:
     ```sql
     ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;
     ALTER TABLE public.<table_name> FORCE ROW LEVEL SECURITY;
     CREATE POLICY tenant_isolation_policy ON public.<table_name> FOR ALL
       USING ((SELECT public.is_app_bypass_rls()) OR organisation_id = (SELECT public.current_app_organisation_id()))
       WITH CHECK ((SELECT public.is_app_bypass_rls()) OR organisation_id = (SELECT public.current_app_organisation_id()));
     ```
4. Apply and test on `dev` (Steps 2–4 above), then repeat `alembic upgrade head` on `staging` / `prod` before deploying new backend code.

---

## 5. Common Errors & Quick Fixes

| Error | Cause | Fix |
| --- | --- | --- |
| `relation "public.profiles" does not exist` | Migrations not applied to the active DB | Run `alembic upgrade head` (Section 2, Step 2) |
| `ConnectionDoesNotExistError: connection was closed in the middle of operation` | Remote Postgres (Render) suspended/expired or IP-blocked | Resume/verify instance in Render dashboard, then re-run Step 1 |
| Changes to `DATABASE_ZOLEXORA_TMS_HOST` ignored | `DATABASE_URL` or `DATABASE_ZOLEXORA_TMS_EXTERNAL_DATABASE_URL` still set | Clear or update higher-precedence keys in Infisical (Section 1) |
| Platform admin endpoints return `0` rows or fail RLS check | Missing `rls_bypass(db)` or DB role has `BYPASSRLS` issue | Ensure `rls_bypass(db)` wraps cross-tenant admin queries/writes |
