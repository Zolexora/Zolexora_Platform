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

It injects two Infisical scopes (env from `INFISICAL_ENV`, default `dev`):

| Scope | Project | Path |
|---|---|---|
| App secrets | `188824cd-…` | `/Firebase_Credentials/Zolexora_TMS` |
| Database | `c4ac7d07-…` | `/Render_Postgraes` |

If Infisical isn't authenticated, the wrapper warns and continues with the current shell environment (non-blocking).

The keys that must exist in Infisical are listed in [`.env.example`](.env.example) (reference only — don't copy it to `.env`).

### Running

```bash
pnpm start:tms              # local dev (backend + web + admin) via scripts/local-start.sh
pnpm docker:tms:start       # Docker stack via scripts/docker-start.sh
pnpm dev:tms:api:infisical  # backend only
```

`NODE_ENV` controls backend strictness: `development` / `test` enable `/docs`; anything else (including unset) runs in production mode.
