## What and why

Closes #

## Service(s)

<!-- e.g. apps/core-platform/zolexora-tms/services/backend, apps/zolexora-auth-service -->

## API / data changes

- [ ] No API contract change
- [ ] API change is backward compatible (or consumers updated in this PR)
- [ ] Database migration included, reversible, and tested on a copy of real data
- [ ] New config read from Infisical only (no `.env`, no default secret values); key added to `docs/secrets.md`

## Security

- [ ] Every new endpoint checks authentication and ownership / tenant scope
- [ ] Input validated server-side; money, coins, stock and payment states verified server-side
- [ ] No secrets or PII in logs

## Verification

<!-- pytest / vitest output, curl examples -->

- [ ] Tests added or updated
- [ ] `ruff check` / lint passes
