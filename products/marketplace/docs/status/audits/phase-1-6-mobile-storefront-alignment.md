# Phase 1.6 mobile storefront alignment audit

Date: 2026-07-14. Starting branch/commit: `main` at `87d751c455c6bd3dfd75d154389fb64745839e12`. All uncommitted Phase 1/1.5 work and the pre-existing documentation deletion were preserved.

## Verdict

**PASS.** Exactly ten workspace packages are discovered; all root checks and complete verification pass. No backend business behavior, schema, payment, authentication, OCI, or remote state changed.

## Structure and identities

| Application | Package | Expo name / slug / scheme | Android / iOS |
| --- | --- | --- | --- |
| Zolexora buyer | `@zolexora/storefront-zolexora-shop-mobile` | Zolexora Shop / `zolexora-buyer` / `zolexora` | `com.zolexora.buyer` |
| Mahila buyer | `@zolexora/storefront-mahila-madel-mobile` | Mahila Madel / `mahila-madel` / `mahilamadel` | `store.mahilamadel.mobile` |
| Shared seller | `@zolexora/seller-portal-mobile` | Zolexora Seller / `zolexora-seller` / `zolexoraseller` | `com.zolexora.seller` |

The buyer and seller directories moved from the retired `apps/mobile/` root into their owning storefront/portal. Mahila mobile is a new text-branded shell pointing to the shared FastAPI development URL. No Mahila brand artwork existed, so no Zolexora asset was reused and final icon/splash artwork is a P1 design blocker.

## Public identity boundary

Zolexora compiles `zolexora-shop`; Mahila compiles `mahila-madel`; conflicting environment keys throw. Seller mobile has no fixed storefront key. These public identifiers are consistency expectations only—not authentication, authorization, or payment account selection. Phase 2 will validate context server-side.

## Tests and commands

| Command | Exit | Evidence |
| --- | ---: | --- |
| `pnpm install`; frozen reinstall | 0 | one root lockfile, all 11 projects including root |
| `pnpm verify:workspace` | 0 | exactly ten packages |
| `pnpm build` | 0 | 8/8 tasks, including three Android exports |
| `pnpm type-check` | 0 | 7/7 tasks, including all mobile apps |
| `pnpm lint` | 0 | 2/2 JavaScript tasks plus Ruff; existing warnings only |
| `pnpm test` | 0 | 3/3 suites, 9 total tests |
| `pnpm verify` | 0 | complete repository sequence passes |
| explicit Zolexora mobile | 0 | type-check, 6 tests, Android export |
| explicit Mahila mobile | 0 | type-check, 2 tests, Android export |
| explicit seller mobile | 0 | type-check and Android export |
| explicit Mahila web | 0 | 1 meaningful API-default test and production build |
| FastAPI compile/Ruff/pytest | 0 | 59 passed; 368 Python 3.14 deprecation warnings |
| `docker compose config --quiet` | 0 | mobile paths and ports 8081/8082/8083 resolve |

## Scope not implemented

No storefront resolver, persistence, listing separation, store-aware commerce, payment routing, sessions, legacy retirement, shared mobile feature package, OCI resources, or production deployment was introduced.

## Remaining blockers

- P0: trusted backend storefront isolation, data ownership, and payment safety.
- P1: approved Mahila mobile artwork, legacy dependency vulnerabilities, broader tests, secure sessions, OCI/ARM64 verification.
- P2: existing frontend lint/deprecation warnings and legacy documentation cleanup.

## Recommended Phase 2

Implement trusted FastAPI storefront/domain context and shared contracts with fail-closed mismatch and isolation tests. Keep payment routing and database migration separate.
