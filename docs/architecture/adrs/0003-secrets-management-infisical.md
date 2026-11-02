# 3. Secrets Management Strategy — Infisical

Date: 2026-10-09

## Status
Accepted

## Context

The Zolexora Platform operates 10+ products with 20+ Supabase databases spread across multiple free-tier accounts. This creates serious risks:

- **Key sprawl:** 20+ `SUPABASE_URL` + `SUPABASE_ANON_KEY` pairs with no central registry.
- **Rotation risk:** Rotating one key requires updating every developer machine, every CI server, and every production host manually.
- **Exposure risk:** `config/envs/zolexora-erp/erp.env.keys` was found committed to the repository with a real `DOTENV_PRIVATE_KEY`. This key must be rotated immediately.
- **Duplication:** `.env.example` files were found in both `config/envs/` (correct) and inside individual `products/*/` folders (redundant). The `products/*/` copies have been removed.

## Decision

Amended 2026-10-31: Infisical is the **only** secret source. There are no `.env` files, no `.env.example` templates and no fallback.

1. **Folders.** Each product's `.infisical.json` names its folder: project `c4ac7d07…`, path `/Zolexora_<Product>` (auth-service still uses project `188824cd…`). Required key names: [docs/secrets.md](../../secrets.md).
2. **One entry point.** Everything that needs secrets runs through `scripts/setup/with-infisical.sh <product-dir> <command>` (`infisical run --recursive`). It exits with an error if the CLI is missing or not authenticated; it never hangs and never continues without secrets.
3. **Compose.** No `env_file:`. Services list variable names under `environment:`; secrets have no defaults (`${VAR}`, never `${VAR:-value}`). Non-secret settings such as ports may keep defaults.
4. **Apps.** Code does not load `.env` files (no `dotenv`, `load_dotenv`, pydantic `env_file`). Secrets have no in-code defaults outside `NODE_ENV=test`.
5. **CI/servers.** Use a machine identity (`INFISICAL_CLIENT_ID`/`INFISICAL_CLIENT_SECRET` → `INFISICAL_TOKEN`).
6. **Git.** `.gitignore` ignores `.env*`, `*.env` and `*.env.example`.

## Consequences

- ✅ No secrets ever live on developer machines or in git history.
- ✅ Key rotation happens in Infisical once and instantly propagates everywhere.
- ✅ Full audit trail of who accessed which secret.
- ⚠️ `config/envs/zolexora-erp/erp.env.keys` was committed. That DOTENV_PRIVATE_KEY **must be regenerated immediately** — treat it as compromised.
