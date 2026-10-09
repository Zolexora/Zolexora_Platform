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

### 1. Single Source of Truth for Templates: `config/envs/`

The `config/envs/<product>/` folder is the canonical location for all `.env.example` files. The structure mirrors the microservice breakdown per product:

```
config/envs/
├── zolexora-ims/
│   ├── admin-backend.env.example
│   ├── user-backend.env.example
│   └── user-frontend.env.example
├── zolexora-marketplace/
│   ├── api.env.example
│   ├── seller-web.env.example
│   └── ...
```

**Rule:** Never create `.env.example` files inside `products/*/`. Always use `config/envs/`.

### 2. Runtime Secrets: Infisical

We adopt [Infisical](https://infisical.com) as the secrets manager across all environments.

**Local development:**
```bash
# Install Infisical CLI
brew install infisical/get-cli/infisical

# Authenticate (one time)
infisical login

# Run any service with secrets injected (no .env file needed)
infisical run --env=dev --path=/zolexora-ims -- pnpm dev
```

**Infisical Vault Structure:**
```
Project: zolexora-platform
├── /zolexora-ims
│   ├── SUPABASE_URL
│   ├── SUPABASE_ANON_KEY
│   └── JWT_SECRET
├── /zolexora-marketplace
│   ├── SUPABASE_URL
│   └── CASHFREE_CLIENT_SECRET
├── /shared
│   ├── CLOUDINARY_CLOUD_NAME
│   └── CLOUDINARY_API_KEY
```

**CI/CD (GitHub Actions):**
```yaml
- name: Fetch Secrets via Infisical
  uses: Infisical/secrets-action@v1
  with:
    client-id: ${{ secrets.INFISICAL_CLIENT_ID }}
    client-secret: ${{ secrets.INFISICAL_CLIENT_SECRET }}
    env-slug: prod
    secret-path: /zolexora-ims
```

### 3. Managing 20+ Free-Tier Supabase Accounts

Since accounts are spread across multiple free-tier projects, the keys must be stored in Infisical per project. Name them clearly to avoid confusion:

```
SUPABASE_IMS_URL        → Supabase project: zolexora-ims-prod
SUPABASE_IMS_ANON_KEY   → Supabase project: zolexora-ims-prod
SUPABASE_MKT_URL        → Supabase project: zolexora-marketplace-prod
SUPABASE_MKT_ANON_KEY   → Supabase project: zolexora-marketplace-prod
```

**Long-term goal:** As you upgrade from free tier, consolidate into 2 Supabase instances (dev + prod) using separate schemas per product, reducing the key count from 40+ to 4.

### 4. .gitignore Rules (Enforced)

The root `.gitignore` enforces the following:
```
.env
.env.local
.env.development
.env.staging
.env.production
*.env
*.env.keys
config/envs/**/*.env     ← real env files, never commit
!*.env.example           ← templates are safe to commit
```

## Consequences

- ✅ No secrets ever live on developer machines or in git history.
- ✅ Key rotation happens in Infisical once and instantly propagates everywhere.
- ✅ Full audit trail of who accessed which secret.
- ⚠️ `config/envs/zolexora-erp/erp.env.keys` was committed. That DOTENV_PRIVATE_KEY **must be regenerated immediately** — treat it as compromised.
