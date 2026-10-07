# Local development runbook

## Install and verify

Prerequisites are Node 20+, pnpm 9, Python 3.12+, and optional Docker Compose. Use development credentials only.

```bash
pnpm install --frozen-lockfile
pnpm verify:workspace
pnpm build
pnpm type-check
pnpm lint
pnpm test
pnpm verify
```

The guard must list exactly ten packages.

## Mobile applications

| Application | Package | Path | Metro |
| --- | --- | --- | ---: |
| Zolexora Shop buyer | `@zolexora/storefront-zolexora-shop-mobile` | `apps/storefronts/zolexora-shop/mobile` | 8081 |
| Mahila Madel buyer | `@zolexora/storefront-mahila-madel-mobile` | `apps/storefronts/mahila-madel/mobile` | 8083 |
| Shared seller | `@zolexora/seller-portal-mobile` | `apps/portals/seller/mobile` | 8082 |

Run with `pnpm dev:zolexora-mobile`, `pnpm dev:mahila-mobile`, or `pnpm dev:seller-mobile`. Buyer `.env` files require the shared API URL and their matching public storefront key. Seller mobile must not have a fixed customer storefront key.

## Web applications

Use `pnpm dev:buyer`, `pnpm dev:mahila`, `pnpm dev:seller`, and `pnpm dev:admin`. The transitional server uses `pnpm dev:mahila-server`.

## FastAPI

```bash
.venv/bin/python -m pip install -r services/marketplace-api/requirements.txt
cd services/marketplace-api
../../.venv/bin/python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Health: `http://127.0.0.1:8000/api/health`.

Storefront context examples:

```bash
curl -H 'X-Storefront-Key: zolexora-shop' http://127.0.0.1:8000/api/storefront/context
curl -H 'X-Storefront-Key: mahila-madel' http://127.0.0.1:8000/api/storefront/context
```

The local shared API has no default storefront. Buyer mobile uses the header; Zolexora browser development resolves the exact `http://localhost:3000` or `http://127.0.0.1:3000` Origin. Seller/admin clients must not install a fixed customer header.

```bash
../../.venv/bin/python -m compileall .
../../.venv/bin/python -m ruff check .
TESTING=true ../../.venv/bin/python -m pytest
```

Local MongoDB and Redis may be started with `docker compose up -d mongo redis`. Current MongoDB/Supabase dependencies and Mahila Express remain transitional.

## Oracle foundation

Set local disposable `MARKETPLACE_ORACLE_*` values from the service `.env.example`. Run `python scripts/validate-oracle-schema.py`; from `services/marketplace-api`, use `alembic heads` and `alembic upgrade head --sql`. With an explicitly disposable localhost Oracle schema and `MARKETPLACE_ORACLE_TEST_ALLOW_DDL=true`, run `alembic upgrade head` twice, then `.venv/bin/python scripts/verify-oracle-runtime.py` from the repository root. The runtime verifier accepts only `127.0.0.1:1521/FREEPDB1` and the synthetic `MARKETPLACE_TEST` schema. Never use a remote, shared, ERP, staging, or production database.
