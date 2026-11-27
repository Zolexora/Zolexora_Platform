# Zolexora TMS Authentication Foundation

> **Note:** TMS migrated from its initial Phase 1 Supabase prototype to the central **Zolexora Auth Service** (`apps/auth-service`). See [auth_inspection_report.md](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/docs/authentication/auth_inspection_report.md) for the full technical audit.

## Boundaries

- **Identity Provider**: All user authentication (Track 1 Owners via Google/email/phone, Track 2 Staff/Drivers via `ZX-ORG`, Track 3 Platform Admins) goes through `apps/auth-service`.
- **TMS Backend**: [zolexora.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/auth/zolexora.py) introspects Bearer tokens against `${AUTH_SERVICE_URL}/api/v1/auth/me` using a pooled `httpx.AsyncClient` and a 30s LRU cache.
- **Authorization & Multi-Tenancy**: Enforced inside TMS via `organisation_members`, `roles`, `user_permission_overrides`, and PostgreSQL Row-Level Security (`app.current_organisation_id` / `app.bypass_rls`).
- **Bootstrap**: `tms-web` uses `GET /api/v1/auth/bootstrap` to load `me`, active `organisation`, `effective_permissions`, and `runtime` configuration in a single round-trip.

## Required Configuration (Infisical `/Zolexora_TMS`)

- `AUTH_SERVICE_URL`, `AUTH_SERVICE_PUBLIC_URL`, `TURNSTILE_SITE_KEY`
- `NEXT_PUBLIC_TMS_CLIENT_FIREBASE_API_KEY`, `NEXT_PUBLIC_TMS_CLIENT_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_TMS_CLIENT_FIREBASE_APP_ID`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `apps/auth-service` must list TMS origins in `CORS_ORIGIN` and TMS hostnames in `TURNSTILE_EXPECTED_HOSTNAMES`.
