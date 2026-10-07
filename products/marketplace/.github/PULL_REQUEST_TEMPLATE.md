## Description

Brief description of the changes introduced by this pull request.

## Related Issues / Architecture Decision Records

- Fixes #(issue)
- Supersedes / Implements ADR #(ADR number if applicable)

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation / Refactoring update

## Scope & Applications Changed

- [ ] `services/marketplace-api` (FastAPI Shared API)
- [ ] `apps/storefronts/zolexora-shop` (Zolexora Shop)
- [ ] `apps/storefronts/mahila-madel` (Mahila Madel)
- [ ] `apps/portals/seller` (Seller Portal)
- [ ] `apps/portals/marketplace-admin` (Marketplace Admin)
- [ ] `packages/*` (Shared TypeScript packages)
- [ ] `infrastructure` (Oracle / Cloud infrastructure)

## Verification & Testing

Commands executed and test outputs:

- [ ] `pnpm verify:workspace`
- [ ] `pnpm build`
- [ ] `pnpm type-check`
- [ ] `pnpm test`
- [ ] Backend pytest / compilation (`ruff check .` & `pytest`)

## Checklist

- [ ] Code complies with repository architecture rules (`AGENTS.md`)
- [ ] Storefront isolation and server-side payment routing respected
- [ ] No hardcoded secrets or environment variables committed
- [ ] Documentation updated under `docs/` / `docs/status/` if applicable
