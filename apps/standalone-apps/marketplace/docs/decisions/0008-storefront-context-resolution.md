# ADR 0008: Storefront context resolution

- **Status:** Accepted
- **Date:** 2026-07-15

## Context

Two customer storefronts call one FastAPI service, while seller and admin applications are cross-store surfaces. Request context must fail closed without pretending that a public browser or mobile signal authorizes access to stored resources.

## Decision

FastAPI owns a static canonical registry for `zolexora-shop` and `mahila-madel`. Customer hosts use exact normalized matching. On `api.zolexora.com`, an exact approved browser Origin or the public `X-Storefront-Key` mobile/local hint may request context. All valid signals must agree; no default exists. Seller and admin hosts never resolve to a customer store. Untrusted `Forwarded`, `X-Forwarded-Host`, and `X-Original-Host` values are ignored until OCI trusted-proxy configuration exists.

Request context is neither authentication nor authorization. It does not establish persisted-resource ownership and cannot select a payment provider or merchant account. Future payment routing must use the immutable storefront stored on the order/payment attempt.

## Reasons

- Exact parsing rejects suffix, substring, user-info, and query-injection attacks.
- Per-request dependencies avoid cross-request context leakage and preserve unscoped legacy routes.
- Shared TypeScript contracts keep buyer application hints consistent without exposing private configuration.

## Consequences

Store-required endpoints can use `require_storefront_context`; optional integration can use `optional_storefront_context`. Unknown, malformed, missing, disabled, or conflicting context fails safely. Database records remain unscoped, seller grants remain absent, and Mahila web remains on its legacy server.

## Alternatives considered

- Default unknown traffic to Zolexora: rejected as unsafe.
- Trust arbitrary forwarded hosts: deferred until trusted proxy ranges are configured.
- Treat the mobile header or Origin as authorization: rejected because clients can forge both.

## Affected modules

FastAPI storefront dependencies/router and CORS, shared API contracts, Zolexora web/mobile, and Mahila mobile.

## Implementation phase

Phase 2.
