# Zolexora TMS

## Getting Started

```bash
pnpm install
infisical login          # one-time; secrets come only from Infisical
```

---

## Secrets & Environment Variables

**Infisical is the only secret source.** No `.env` files are read, and there is no dotenvx or Bitwarden step.

Every command that needs secrets runs through one wrapper:

```bash
bash scripts/setup/with-infisical.sh products/zolexora-tms <command>
```

It injects every secret under one Infisical folder tree, recursively (env from `INFISICAL_ENV`, default `dev`):

| Project | Path | Sub-folders |
|---|---|---|
| Zolexora_Platform (`c4ac7d07-…`) | `/Zolexora_TMS` | `Cache_And_Async/Redis`, `Database/Postgres_Database`, `Object_Storage`, `Media_CDN/Cloudinary`, `Core_Application`, `Payment_Gateway`, `Cloudflare`, `Docker_Images` |

The backend reads the vault's own key names (`DATABASE_ZOLEXORA_TMS_*`, `REDIS_HOST`/`REDIS_PORT`/…, `STORAGE_*`) as well as the canonical names listed in `services/backend/app/core/config.py`.

If Infisical isn't installed or authenticated, the wrapper exits with an error. There is no fallback and no `.env` file.

### Authentication (Zolexora auth service)

TMS has no auth of its own: every app signs in through `apps/zolexora-auth-service`, like platform-admin.

| App | Login | Vault keys |
|---|---|---|
| tms-web | Owners: Track 1 (sign in / sign up / reset). Staff: Track 2 employee login with the ZX-ORG id | `AUTH_SERVICE_PUBLIC_URL`, `TURNSTILE_SITE_KEY` |
| tms-admin | Track 3 platform-admin login | `AUTH_SERVICE_PUBLIC_URL`, `TURNSTILE_SITE_KEY` |
| tms-mobile | Track 2 employee login (Turnstile in a WebView, token in the device keystore) | `AUTH_SERVICE_PUBLIC_URL`, `TURNSTILE_SITE_KEY`, `EXPO_PUBLIC_API_BASE_URL` |
| backend | Checks every bearer token with the auth service's `/api/v1/auth/me` (30 s cache) | `AUTH_SERVICE_URL` |

- Platform admins are the auth service's `is_platform_admin` users.
- Employees (tokens with a ZX-ORG id) work in the TMS workspace a platform admin linked to that ZX-ORG (`PUT /api/v1/admin/organisations/{id}/zolexora-org`); their membership is created on first sign-in.
- Drivers on mobile are matched to their driver record by email (`GET /api/v1/drivers/me`).
- The operations WebSocket takes the token in its first message (`{"type":"auth","token":...}`), never in the URL.
- The auth service must list the TMS origins in `CORS_ORIGIN` and their hostnames in `TURNSTILE_EXPECTED_HOSTNAMES`.

### Running

```bash
pnpm start:tms              # local dev (backend + web + admin) via scripts/local-start.sh
pnpm docker:tms:start       # Docker stack via scripts/docker-start.sh
pnpm dev:tms:api:infisical  # backend only
```

`NODE_ENV` controls backend strictness: `development` / `test` enable `/docs`; anything else (including unset) runs in production mode.
