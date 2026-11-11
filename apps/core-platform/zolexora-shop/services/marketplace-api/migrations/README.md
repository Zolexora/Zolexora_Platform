# PostgreSQL migrations

Alembic is the only Marketplace schema authority. Set a standard PostgreSQL `DATABASE_URL`, then run `alembic upgrade head` from `services/marketplace-api`. Application startup never creates or migrates the schema.

- Review deterministic SQL offline: `alembic upgrade head --sql`.
- Inspect the chain: `alembic history` and `alembic heads`.
- Validate a disposable database: upgrade from empty to head, run `alembic current`, then run upgrade-to-head again as a no-op.
- Applied revisions are immutable and forward-only; repairs use a new revision.
- PostgreSQL 16 is the tested baseline. Standard PostgreSQL-compatible managed services require no application-contract change.

The superseded Oracle migration remains under `migrations/versions/` as historical evidence and is excluded from the active PostgreSQL version location.
