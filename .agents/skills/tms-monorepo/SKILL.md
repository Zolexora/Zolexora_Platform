---
name: tms-monorepo
description: Runbooks and architecture guidelines for Zolexora TMS (apps/platform-core/zolexora-tms), covering Vite + React 19 frontends, Expo mobile, FastAPI + SQLAlchemy + Alembic backend, PostgreSQL RLS, Infisical secrets, and GHCR Docker Compose.
---

# Zolexora TMS Guide

This skill provides procedures for navigating, building, running, and modifying **Zolexora TMS** at [apps/platform-core/zolexora-tms](file:///workspaces/Zolexora_Platform/apps/platform-core/zolexora-tms).

## Architecture

- **`apps/tms-web`**: Core TMS & Client Portal SPA (Vite 6, React 19, Tailwind CSS v4, `@zolexora/auth-client`). Dev port `3031`.
- **`apps/tms-admin`**: Platform Admin SPA (Vite 6, React 19, Tailwind CSS v4, `@zolexora/auth-client`). Dev port `3032`.
- **`apps/tms-mobile`**: Driver mobile app (Expo SDK 54, React Native 0.81, Expo Router).
- **`services/backend`**: FastAPI + SQLAlchemy 2 (asyncpg) + Alembic + Dramatiq/Redis API. Port `4031:4030`.
- **`compose.yaml`** & **`nginx-conf.d/`**: Production GHCR images (`pull_policy: missing`, no `build:` blocks) behind Nginx on port `3090`.

## Essential Commands (from monorepo root)

All secret-dependent commands inject Infisical (`/Zolexora_TMS`) via `scripts/setup/with-infisical.sh`:
- **Start local dev**: `pnpm start:tms` (starts backend on `4031`, `tms-web` on `3031`, `tms-admin` on `3032`)
- **Start Docker stack**: `pnpm docker:tms:start` (Nginx gateway on `http://localhost:3090`)
- **Build frontends**:
  - `pnpm --filter "@zolexora/tms-web..." build`
  - `pnpm --filter "@zolexora/tms-admin..." build`
  - `pnpm --filter @zolexora/tms-mobile run typecheck`
- **Backend tests**: `pnpm --filter @zolexora/tms run test:backend` (runs pytest via Infisical)

## Verification Checklist

1. Ensure shared packages (`@zolexora/auth-client`, `@zolexora/utils`) are built before running Vite/tsc in `tms-web` or `tms-admin`.
2. Never commit `.env` files; all secrets and runtime env vars come from Infisical (`/Zolexora_TMS`).
3. Ensure `AUTH_SERVICE_PUBLIC_URL` / `TURNSTILE_SITE_KEY` match `CORS_ORIGIN` and `TURNSTILE_EXPECTED_HOSTNAMES` in `apps/auth-service`.
