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
| Zolexora_Platform (`c4ac7d07-…`) | `/Zolexora_Specfic_Credentials/Zolexora_TMS` | `Cache_And_Async/Redis`, `Database/Postgres_Database`, `Firebase_Crediential/*`, `Object_Storage`, `Media_CDN/Cloudinary`, `Core_Application`, `Payment_Gateway`, `Cloudflare`, `Docker_Images` |

The backend reads the vault's own key names (`DATABASE_ZOLEXORA_TMS_*`, `REDIS_HOST`/`REDIS_PORT`/…, `STORAGE_*`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`) as well as the canonical names listed in `apps/backend/app/core/config.py`.

If Infisical isn't installed or authenticated, the wrapper exits with an error. There is no fallback and no `.env` file.

### Running

```bash
pnpm start:tms              # local dev (backend + web + admin) via scripts/local-start.sh
pnpm docker:tms:start       # Docker stack via scripts/docker-start.sh
pnpm dev:tms:api:infisical  # backend only
```

`NODE_ENV` controls backend strictness: `development` / `test` enable `/docs`; anything else (including unset) runs in production mode.
