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
bash products/zolexora-tms/scripts/with-secrets.sh <command>
```

It injects every secret under one Infisical folder tree, recursively (env from `INFISICAL_ENV`, default `dev`):

| Project | Path | Sub-folders |
|---|---|---|
| Zolexora_Platform (`c4ac7d07-…`) | `/Zolexora_Specfic_Credentials/Zolexora_TMS` | `Cache_And_Async/Redis`, `Database/Postgres_Database`, `Firebase_Crediential/*`, `Object_Storage`, `Media_CDN/Cloudinary`, `Core_Application`, `Payment_Gateway`, `Cloudflare`, `Docker_Images` |

The backend reads the vault's own key names (`DATABASE_ZOLEXORA_TMS_*`, `REDIS_HOST`/`REDIS_PORT`/…, `STORAGE_*`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`) as well as the canonical ones in `.env.example`.

If Infisical isn't authenticated, the wrapper warns and continues with the current shell environment (non-blocking).

The keys that must exist in Infisical are listed in [`.env.example`](.env.example) (reference only — don't copy it to `.env`).

### Running

```bash
pnpm start:tms              # local dev (backend + web + admin) via scripts/local-start.sh
pnpm docker:tms:start       # Docker stack via scripts/docker-start.sh
pnpm dev:tms:api:infisical  # backend only
```

`NODE_ENV` controls backend strictness: `development` / `test` enable `/docs`; anything else (including unset) runs in production mode.
