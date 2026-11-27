# Zolexora TMS — Authentication & Validation Inspection Report

**Date:** 2026-11-27  
**Scope:** End-to-end authentication, session validation, RBAC/RLS enforcement, configuration, and latency across [zolexora-tms](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms), [auth-client](file:///workspaces/Zolexora_Platform/packages/auth-client), and [auth-service](file:///workspaces/Zolexora_Platform/apps/auth-service).

---

## 1. Architecture Overview

Zolexora TMS delegates all credential verification and token issuance to the central **Zolexora Auth Service** (`apps/auth-service`). TMS does not store passwords or sign/verify JWTs locally in production.

| Component | Auth Track / Mechanism | Runtime Config Keys | Key Entry Points |
| --- | --- | --- | --- |
| **`tms-web`** (Vite + React 19) | Track 1 (Owner: Google / Email / Phone via Firebase + Auth Service) & Track 2 (`ZX-ORG` Staff login) | `AUTH_SERVICE_PUBLIC_URL`, `TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_TMS_CLIENT_FIREBASE_*`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `VITE_API_BASE_URL` | [App.tsx](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/apps/tms-web/src/App.tsx), [authentication-form.tsx](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/apps/tms-web/src/components/authentication-form.tsx), [useAuth.ts](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/apps/tms-web/src/features/auth/useAuth.ts) |
| **`tms-admin`** (Vite + React 19) | Track 3 (Platform Admin login; requires `is_platform_admin`) | `AUTH_SERVICE_PUBLIC_URL`, `TURNSTILE_SITE_KEY`, `VITE_API_BASE_URL` | [App.tsx](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/apps/tms-admin/src/App.tsx), [LoginPage.tsx](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/apps/tms-admin/src/features/auth/LoginPage.tsx), [useAdminAuth.ts](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/apps/tms-admin/src/features/auth/useAdminAuth.ts) |
| **`tms-mobile`** (Expo Router) | Track 2 (`ZX-ORG` Employee login + Turnstile WebView + `expo-secure-store`) | `AUTH_SERVICE_PUBLIC_URL`, `TURNSTILE_SITE_KEY`, `EXPO_PUBLIC_API_BASE_URL` | [AuthContext.tsx](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/apps/tms-mobile/src/context/AuthContext.tsx), [config.ts](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/apps/tms-mobile/src/lib/config.ts) |
| **`services/backend`** (FastAPI) | Bearer token introspection via Auth Service `GET /api/v1/auth/me` (30s in-memory cache; `HS256` test tokens only when `NODE_ENV=test` + `JWT_SECRET`) | `AUTH_SERVICE_URL`, `TMS_IN_DOCKER`, `CORS_ORIGINS`, `DATABASE_ZOLEXORA_TMS_*` | [zolexora.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/auth/zolexora.py), [dependencies.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/auth/dependencies.py), [users/routes.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/modules/identity/users/routes.py) |

---

## 2. Step-by-Step Validation Flow

### A. Initial Page Load / Session Hydration (`tms-web`)

1. **`ZolexoraAuthProvider.hydrate()`** ([provider.tsx](file:///workspaces/Zolexora_Platform/packages/auth-client/src/react/provider.tsx#L107-L173))
   - Reads `zolexora_session` from `localStorage`.
   - Checks client-side JWT `exp` claim if present.
   - Calls `GET ${AUTH_SERVICE_PUBLIC_URL}/api/v1/auth/me` with `Authorization: Bearer <token>`.
   - `loading` stays `true` until this remote HTTP request finishes.

2. **`useAuth()` Stage 1 — TMS User & Membership** ([useAuth.ts](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/apps/tms-web/src/features/auth/useAuth.ts#L13-L21))
   - Enabled only after `user` is set (`enabled: !!token`).
   - Calls `GET ${VITE_API_BASE_URL}/api/v1/auth/me` on `tms-backend`, sending `Authorization` and `X-Organization-Id` ([api.ts](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/apps/tms-web/src/lib/api.ts#L8-L31)).
   - Inside `tms-backend` ([users/routes.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/modules/identity/users/routes.py#L35-L59)):
     - `identity_from_token()` → `introspect(token)` ([zolexora.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/auth/zolexora.py#L45-L78)): checks 30s `_cache`; on miss, opens a new `httpx.AsyncClient(timeout=5.0)` and calls `GET ${AUTH_SERVICE_URL}/api/v1/auth/me`.
     - `ensure_profile(identity)` ([dependencies.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/auth/dependencies.py#L87-L103)): if `identity.id` is not in `_known_profiles`, opens a **separate** `AsyncSessionLocal()` transaction under `rls_bypass(db)` to upsert `public.profiles` and commits.
     - `resolve_membership(db, identity, requested_org)` ([dependencies.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/auth/dependencies.py#L109-L157)): under `rls_bypass(db)`, looks up active membership (or auto-provisions membership for `zolexora_org_id` employees if the organisation is linked).
     - Calls `await db.commit()`.

3. **`useAuth()` Stage 2 — Organisation & Effective Permissions** ([useAuth.ts](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/apps/tms-web/src/features/auth/useAuth.ts#L32-L49))
   - Enabled only after `authMe?.organisation_id` is resolved (`enabled: !!token && !!authMe?.organisation_id`).
   - Fires in parallel:
     - `GET /api/v1/organisations/me`
     - `GET /api/v1/organisations/me/effective-permissions`
   - Each request re-runs `get_current_active_organisation()` → `introspect()` (cache hit within 30s) → `resolve_membership()` (another Postgres `rls_bypass` round-trip) → `set_tenant_context()` → endpoint query + `commit`.
   - Meanwhile, [ProtectedRoute.tsx](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/apps/tms-web/src/routes/ProtectedRoute.tsx#L8-L17) (and [ClientRoute.tsx](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/apps/tms-web/src/routes/ClientRoute.tsx#L8-L17)) blocks rendering with `"Validating Zolexora TMS session..."` until **Stages 1, 2, and 3** all finish.

4. **Stage 3 — Application Runtime Config** ([ApplicationRuntimeProvider.tsx](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/apps/tms-web/src/providers/ApplicationRuntimeProvider.tsx#L35-L60))
   - Mounts only after `ProtectedRoute` / `ClientRoute` resolves `<Outlet />`.
   - Fires `GET /api/v1/application/runtime` and blocks the UI again with `"Loading Application Configuration..."` until `ApplicationRuntimeService.get_runtime_configuration()` completes against Postgres.

### B. WebSocket Ops Channel (`/ws/ops/{org_id}`)

- [dispatch/routes.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/modules/operations/dispatch/routes.py#L64-L88) accepts the socket, enforces a 5s timeout for `{"type":"auth","token":...}` (never passes token in URL), validates via `identity_from_token` + `resolve_membership`, and replies `{"type":"auth_ok"}`.

---

## 3. Why Validation Is Slow (Measured Breakdown)

Live measurements taken from this workspace against the configured `dev` infrastructure:

| Hop / Operation | Measured Timing | Notes |
| --- | --- | --- |
| `https://zolexora--authservise--lmdkjzs69rlx.code.run/health` (cold/idle) | **`2.542s`** (`connect=0.249s`, `tls=0.398s`, `ttfb=2.542s`) | Cold/idle container wakeup adds ~2s |
| `https://zolexora--authservise--lmdkjzs69rlx.code.run/api/v1/auth/me` (warm) | **`0.410s`** (`connect=0.143s`, `tls=0.276s`, `ttfb=0.410s`) | Cross-region HTTPS round-trip + TLS |
| `dpg-dbg6bdpsrm7s73cl9ac0-a.oregon-postgres.render.com:5432` (Render Oregon) | **Connect+TLS `1.483s`**, query 1 **`0.458s`**, query 2 **`0.229s`** | Workspace (`BOM` region) to US-West Oregon adds `~230ms` per SQL statement |
| Backend `GET /ready` (`SELECT 1` on fresh pool conn) | **`1.621s`** | Reflects Oregon Postgres handshake + query RTT |

### Compounding Code & Architecture Causes
1. **4-Stage Sequential Frontend Waterfall**:
   `AuthProvider.hydrate` → `/api/v1/auth/me` → (`/api/v1/organisations/me` + `/effective-permissions`) → `/api/v1/application/runtime`. None of the later stages overlap with earlier ones, and both `ProtectedRoute` and `ApplicationRuntimeProvider` render blocking full-screen loaders.
2. **Unpooled `httpx.AsyncClient` in `introspect()`**:
   [zolexora.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/auth/zolexora.py#L63) opens a new `httpx.AsyncClient` on every cache miss instead of reusing a persistent client, adding a `~0.28s–0.40s` TCP+TLS handshake every 30s per unique token.
3. **Extra DB Session & Multiple `set_config` Round-Trips per Request**:
   - `ensure_profile()` opens a separate `AsyncSessionLocal()` session and commits before `resolve_membership()` runs in the request session.
   - `rls_bypass(db)` ([session.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/db/session.py#L49-L57)) issues 2 separate SQL statements (`set_config(..., 'on', true)` before and `'off'` after), and `set_tenant_context()` ([session.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/db/session.py#L43-L46)) issues another SQL statement — each costing `~230ms` over Oregon RTTs.
   - Even read-only `GET /api/v1/auth/me` calls `await db.commit()` explicitly ([users/routes.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/modules/identity/users/routes.py#L46)), and `get_db()` commits again on generator exit ([session.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/db/session.py#L59-L68)).
4. **Idle/Cold Remote Services**:
   Render free/starter Postgres instances and `code.run` containers sleep or close idle connections (observed earlier as `ConnectionDoesNotExistError: connection was closed in the middle of operation` on Render Postgres startup and `2.54s` TTFB on `zolexora--authservise`).

---

## 4. Data Structures & Algorithms (DSA) Complexity Analysis

### Summary Table

Let:
- $N$ = cached tokens (`_CACHE_MAX = 10,000`), $U$ = total unique user IDs ever seen
- $C$ = capabilities in `TMS_CAPABILITY_REGISTRY` ($M$ modules $\times$ $Pg$ pages $\times$ $A$ actions)
- $P_{\text{role}}$ = permissions in a role version, $O_v$ = user permission overrides, $V$ = historical versions per role
- $R$ = roles in org, $K$ = org members, $T$ = total tenants, $M_{\text{all}}$ = total members across all tenants
- $R_{\text{auth}}$ = auth-service network RTT, $R_{\text{db}}$ = Postgres query RTT

| Operation / Component | Current Data Structure & Algorithm | Time Complexity | Space Complexity | DSA Bottleneck / Flaw |
| --- | --- | --- | --- | --- |
| Token cache lookup (`introspect`) | `dict[str, tuple[float, dict]]` keyed by `SHA-256(token)` ([zolexora.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/auth/zolexora.py#L18-L78)) | $O(1)$ avg lookup; **$O(N)$ spike on full `.clear()`** | $O(N)$ bounded ($N \le 10^4$) | `_cache.clear()` at capacity wipes *all* valid entries at once → thundering herd of $R_{\text{auth}}$ calls; unpooled `httpx.AsyncClient` pays TLS handshake per miss |
| Profile existence cache (`ensure_profile`) | `set[uuid.UUID]` (`_known_profiles`) ([dependencies.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/auth/dependencies.py#L84-L103)) | $O(1)$ avg | **$O(U)$ unbounded** | Never evicted → monotonic memory growth over worker lifetime |
| Permission check (`has_permission`) | `list[str]` + `in` operator ([dependencies.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/auth/dependencies.py#L36-L45), [useAuth.ts](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/apps/tms-web/src/features/auth/useAuth.ts#L63)) | **$O(P)$ linear scan** per check | $O(P)$ | Using `set` (`frozenset` / JS `Set`) reduces membership check from $O(P)$ to $O(1)$ |
| Effective permissions (`resolve_effective_permissions`) | SQL queries + `set` union/difference + `sorted(caps & VALID_CAPABILITIES)` + `_build_structured` ([roles/service.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/modules/identity/roles/service.py#L495-L595)) | $O(P_{\text{role}} + O_v + C \log C)$ CPU + $O(4\text{–}6 \cdot R_{\text{db}})$ I/O | $O(C + P_{\text{role}} + O_v)$ | Re-queries `OrganisationMember` already loaded in `get_current_active_organisation()`; `sorted()` runs $O(C \log C)$ on every call even for Commanders (`VALID_CAPABILITIES` could be pre-sorted once) |
| List org roles (`list_roles`) | `selectinload(versions -> permissions)` + Python `next(...)` linear search ([roles/service.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/modules/identity/roles/service.py#L108-L155)) | $O(\sum R \cdot V)$ scan + $O(\sum R \cdot V \cdot P)$ hydration | **$O(\sum R \cdot V \cdot P)$** | Loads **all historical role versions & permissions** from DB only to keep `version_number == current_version` |
| List members with roles (`list_members_with_roles`) | Hash-join `dict[member_id, RoleAssignment]` ([roles/service.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/modules/identity/roles/service.py#L602-L630)) | $O(K)$ | $O(K)$ | Good $O(K)$ hash-join (avoids $O(K^2)$), though lacks pagination if $K$ grows large |
| Runtime config (`get_runtime_configuration`) | **10 sequential** SQL queries + hash maps + 3-level nested registry loop ([customization/service.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/modules/core/customization/service.py#L37-L186)) | $O(C + \text{configs}) + \mathbf{10 \cdot R_{\text{db}}}$ serial I/O | $O(C + \text{configs})$ | Critical path is $10 \cdot R_{\text{db}}$ sequential round-trips (queries 2–10 only depend on `app_def.id`); `db_actions` map omits `module_code` (hash-key collision risk) |
| Admin org listing (`list_admin_organisations`) | Pre-fetched `dict` maps (`counts_map`, `quotas_map`, `members_map`) ([admin_routes.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/modules/core/platform/admin_routes.py#L107-L174)) | $O(T + M_{\text{all}})$ | **$O(T + M_{\text{all}})$ unbounded** | Hash-join avoids $O(T \cdot M_{\text{all}})$ N+1 queries, but loads entire `organisations`, `tenant_quotas`, and `organisation_members` tables without `LIMIT`/pagination |
| Frontend session bootstrap (`useAuth` + `ApplicationRuntimeProvider`) | Serial dependency graph across 4 stages | **$O(D \cdot (R_{\text{auth}} + R_{\text{db}}))$** with depth $D \approx 4$ HTTP / $18\text{–}25$ SQL RTTs | $O(C)$ in React Query cache | Critical-path latency is dominated by serial network depth $D$, not CPU work |

### Key DSA Observations

1. **Network-Depth Dominated Critical Path ($O(D \cdot R)$ vs CPU $O(C \log C)$)**:
   - In-memory work during validation is microseconds ($O(1)$ hashes + small $O(C \log C)$ capability tree), whereas serial I/O depth is **4 HTTP stages** and **~18–25 sequential SQL round-trips** (including `ensure_profile`, `rls_bypass` `on`/`off`, `set_tenant_context`, duplicate `OrganisationMember` lookups in `get_organisation_by_id` and `resolve_effective_permissions`, and 10 serial queries in `get_runtime_configuration`).
2. **Cache Eviction Cliff (`_cache.clear()`) & Unbounded Set (`_known_profiles`)**:
   - `_cache` in `zolexora.py` uses wholesale `.clear()` at $N = 10{,}000$, creating an $O(N)$ cache stampede under high concurrency. An $O(1)$ LRU / `OrderedDict` (evicting expired entries first, then oldest) eliminates stampedes.
   - `_known_profiles` in `dependencies.py` has no eviction bound ($O(U)$ memory leak).
3. **Over-Hydration in `list_roles` & Unbounded Admin Queries**:
   - Loading all historical `OrganisationRoleVersion` rows (`O(R · V · P)`) and scanning linearly in Python (`next(...)`) wastes DB bandwidth and memory when SQL can join/filter `version_number = current_version` directly.
   - `list_admin_organisations` loads all tenants and members into memory without cursor/offset pagination.
4. **Hash-Key Collision Bug in `ApplicationRuntimeService`**:
   - [customization/service.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/modules/core/customization/service.py#L61-L75) keys `db_pages` by `f"{p.module_code}:{p.page_code}"` but keys `db_actions` by `f"{a.page_code}:{a.action_code}"` (missing `module_code`), so identical `page_code:action_code` pairs across different modules collide in the dictionary.

---

## 5. Bugs & Security / Correctness Gaps Found

### High Severity

1. **`require_permission()` Always Rejects Non-Commander Users (`403`)**
   - [AuthenticatedUser](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/auth/dependencies.py#L30-L46) defines `permissions: List[str] = []` and `role_code: Optional[str] = None`.
   - [get_current_active_organisation()](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/auth/dependencies.py#L170-L192) constructs `AuthenticatedUser` **without populating `permissions` or `role_code`**.
   - [require_permission()](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/auth/dependencies.py#L213-L221) checks `user.has_permission(permission)` (`self.is_commander or permission in self.permissions`). Any non-commander member—even with a role granting `users.manage`—is denied `403` on endpoints like `GET /api/v1/organisations/members`, `POST /api/v1/organisations/members/invite`, and `DELETE /api/v1/organisations/members/{user_id}` ([organisations/routes.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/modules/identity/organisations/routes.py#L69-L114)).

2. **Platform Admin & Control-Plane Routes Missing `rls_bypass(db)`**
   - Migration [e10000000001_enable_tenant_row_level_security.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/alembic/versions/e10000000001_enable_tenant_row_level_security.py#L58-L90) enables and **`FORCE`s Row-Level Security** on every `public` table containing an `organisation_id` column (except `organisations`, which has `ENABLE` without `FORCE`).
   - Endpoints in [admin_routes.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/modules/core/platform/admin_routes.py#L82-L336) and [platform/routes.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/modules/core/platform/routes.py#L65-L100) use `require_platform_admin` (which sets neither `app.current_organisation_id` nor `app.bypass_rls`) while querying/inserting into `organisation_members`, `tenant_quotas`, `organisation_database_assignments`, and `platform_audit_logs` (all have `organisation_id` in [platform/models.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/modules/core/platform/models.py#L53-L165)).
   - Under a `NOBYPASSRLS` Postgres role, cross-tenant `SELECT`s return `0` rows and `INSERT`s specifying `organisation_id` fail RLS `WITH CHECK` enforcement.

### Medium Severity

3. **Stale `organisation-me` React Query Cache Key**
   - In [useAuth.ts](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/apps/tms-web/src/features/auth/useAuth.ts#L37), `organisation-me` uses `queryKey: ['organisation-me', token]` (missing `authMe?.organisation_id`, unlike `effective-permissions` at line 46 which includes it). Switching organisations without re-logging in can briefly serve the previous organisation's cached object unless invalidated manually.

4. **Turnstile StrictMode Lifecycle Warnings (`@zolexora/auth-client`)**
   - [tms-web/src/main.tsx](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/apps/tms-web/src/main.tsx#L7) enables `<React.StrictMode>`, while [TurnstileWidget](file:///workspaces/Zolexora_Platform/packages/auth-client/src/turnstile/widget.tsx#L169-L182) calls `window.turnstile.remove()` inside `useEffect` cleanup after React detaches the DOM node, producing harmless dev console warnings (`Cannot find Widget ...` / `Nothing to remove found for the provided container`).

5. **Outdated Auth Documentation & Skill Guidelines**
   - [phase_1_auth_foundation.md](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/docs/authentication/phase_1_auth_foundation.md) still documents Supabase Auth (`NEXT_PUBLIC_SUPABASE_URL`, `/auth/callback`), even though TMS now uses `apps/auth-service` + Firebase (for Track 1 Google/phone verification).
   - [.agents/skills/tms-monorepo/SKILL.md](file:///workspaces/Zolexora_Platform/.agents/skills/tms-monorepo/SKILL.md) still documents Next.js 16, `apps/tms`, `apps/admin`, and `npm run` instead of Vite/Expo/FastAPI/pnpm/Infisical.

6. **Unimplemented Endpoint Stub**
   - `DELETE /api/v1/organisations/members/{user_id}` in [organisations/routes.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/modules/identity/organisations/routes.py#L109-L128) returns `501 Not Implemented`.

---

## 6. Configuration Rules Verified During Troubleshooting

- **Hostname Allowlists**:
  - Cloudflare Turnstile & `apps/auth-service` ([turnstile.service.ts](file:///workspaces/Zolexora_Platform/apps/auth-service/src/services/turnstile.service.ts#L73-L75)) perform exact hostname matching against `TURNSTILE_EXPECTED_HOSTNAMES` (`localhost,auth.zolexora.com,tms.zolexora.com`). Use `http://localhost:3031` (or `*.localhost` if explicitly added to Cloudflare + `TURNSTILE_EXPECTED_HOSTNAMES` + `CORS_ORIGIN`), **not** `http://127.0.0.1:3031`.
- **CORS Origin Format**:
  - `apps/auth-service` ([env.ts](file:///workspaces/Zolexora_Platform/apps/auth-service/src/config/env.ts#L10-L45)) expects a **comma-separated string** for `CORS_ORIGIN` (no JSON brackets/quotes) and requires a process restart/redeploy to reload changes.
- **API Base URL Scheme**:
  - `VITE_API_BASE_URL` in Infisical (`/Zolexora_TMS`) must include the protocol (`http://127.0.0.1:4031`) or be empty (`""` to use Vite's `/api` proxy).

---

## 7. Production-First Remediation Plan (Priority Order)

All fixes below are designed for **production reliability, security, and performance** (so dev behaves like production rather than relying on local-only shortcuts):

1. **Collapse the 4-Stage Auth & Bootstrap Waterfall (High Impact — Production & Dev)**
   - **Backend HTTP pooling**: Keep a shared persistent `httpx.AsyncClient` (with keep-alive limits and timeouts, closed in FastAPI `lifespan`) in [zolexora.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/auth/zolexora.py) instead of opening a new TLS connection per cache miss.
   - **Single session/transaction for auth resolution**: Combine `ensure_profile()` (when unseen) and `resolve_membership()` efficiently, avoid redundant `db.commit()` on read-only `/api/v1/auth/me`, and fold `set_config` calls cleanly.
   - **Collapse `ApplicationRuntimeService` serial queries & cache per org**: Replace the 10 sequential `await db.execute()` calls in [customization/service.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/modules/core/customization/service.py) with batched/joined queries or cached per-org runtime payloads (invalidated on customization writes), and fix `db_actions` key to include `module_code`.
   - **Bootstrap endpoint / parallelization**: Return active `organisation` + `effective_permissions` (or fetch `organisations/me`, `effective-permissions`, and `application/runtime` concurrently once `organisation_id` is known, or via a single `/api/v1/auth/bootstrap` endpoint) instead of blocking the UI behind 4 sequential round-trips (`ProtectedRoute` → `ApplicationRuntimeProvider`).
   - **Avoid duplicate `/api/v1/auth/me` introspection on hydration**: When `ZolexoraAuthProvider` ([provider.tsx](file:///workspaces/Zolexora_Platform/packages/auth-client/src/react/provider.tsx)) has a stored non-expired session, `tms-backend` already introspects the Bearer token on the first API call — validate in the background or rely on backend `401` rather than blocking the entire app before TMS API calls even begin.

2. **Colocate Production Services & Database in the Same Region (High Impact — Infra)**
   - Keep `tms-backend`, TMS Postgres, and `auth-service` in the **same cloud region / private network** (e.g. avoid India/EU app calling US-West Oregon Postgres over public TLS, which adds `~230ms` per SQL query and `~1.48s` per cold handshake).
   - Enable keep-alive / minimum warm instances (avoid cold-sleeping containers on `auth-service` and Render Postgres) so production requests don't hit `2.5s+` cold wakeups or `ConnectionDoesNotExistError`.

3. **Fix RBAC & RLS Correctness Bugs (Critical for Production)**
   - **Populate permissions in `get_current_active_organisation()`** ([dependencies.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/auth/dependencies.py#L170-L192)) or update `require_permission()` to resolve effective permissions (`resolve_effective_permissions`) for non-commander users so role-based permissions work in production.
   - **Add `async with rls_bypass(db):`** to cross-tenant queries and writes in [admin_routes.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/modules/core/platform/admin_routes.py) and [platform/routes.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/modules/core/platform/routes.py) so platform-admin endpoints work under `NOBYPASSRLS` + `FORCE ROW LEVEL SECURITY`.

4. **DSA & Memory Safety Improvements**
   - Replace `_cache.clear()` in [zolexora.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/auth/zolexora.py#L75-L76) with $O(1)$ `OrderedDict` LRU + TTL eviction to prevent cache-clear stampedes.
   - Bound `_known_profiles` in [dependencies.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/auth/dependencies.py#L84) (LRU/max-size cap) to eliminate unbounded memory growth.
   - Store `permissions` as a `frozenset`/`set` on `AuthenticatedUser` (and a `Set` in `useAuth.ts`) for $O(1)$ `has_permission()` lookups instead of $O(P)$ linear scans; precompute sorted `ALL_CAPABILITIES_SORTED` & structured tree once for Commanders.
   - Filter `OrganisationRoleVersion.version_number == OrganisationRole.current_version` in SQL in `list_roles()` ([roles/service.py](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/services/backend/app/modules/identity/roles/service.py#L108-L155)) instead of hydrating all historical versions; add pagination to `list_admin_organisations()`.

5. **Frontend Cache & Lifecycle Fixes**
   - Include `authMe?.organisation_id` in the `organisation-me` `queryKey` in [useAuth.ts](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/apps/tms-web/src/features/auth/useAuth.ts#L37).
   - Switch [TurnstileWidget](file:///workspaces/Zolexora_Platform/packages/auth-client/src/turnstile/widget.tsx#L169-L182) cleanup to `useLayoutEffect` so `turnstile.remove()` executes before React detaches DOM nodes.
   - Update [phase_1_auth_foundation.md](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms/docs/authentication/phase_1_auth_foundation.md) and [.agents/skills/tms-monorepo/SKILL.md](file:///workspaces/Zolexora_Platform/.agents/skills/tms-monorepo/SKILL.md) to reflect the current Auth Service + Vite/Expo/FastAPI architecture.
