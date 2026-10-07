# ADR 0007: Separate buyer mobile applications

- Status: Accepted
- Date: 2026-07-14

## Context

Zolexora Shop and Mahila Madel are separate customer brands. A generic buyer binary would couple branding and application-store identities even though both consume the same marketplace platform.

## Decision

Each storefront owns a separate buyer mobile binary. Zolexora mobile and Mahila mobile have independent names, schemes, package/bundle identifiers, compiled storefront expectations, and branding. Both use the shared FastAPI API and will reuse shared contracts and commerce modules when those modules exist. One seller mobile application remains shared across storefronts and receives operational scope from authenticated seller permissions.

Public app/storefront identity is not authentication or authorization. It cannot choose a payment provider or merchant account. Payment routing remains server-side from the trusted persisted order. Mahila mobile features will be added incrementally rather than copied from Zolexora.

## Reasons

- Preserve independent customer brands and release identities.
- Keep seller tooling cross-store.
- Allow shared platform behavior without merging customer binaries.

## Consequences

The workspace contains ten packages. Mobile buyers live under their storefronts; seller mobile lives under the seller portal. Approved Mahila icon and splash artwork is still required before release. The future storefront-context ADR is 0008.

## Alternatives considered

- One theme-switching buyer binary: rejected because store identity and releases would be coupled.
- Clone the full Zolexora app: rejected because it would copy brand and premature commerce behavior.

## Affected modules

Expo applications, workspace tooling, CI, Compose, documentation, and future shared contracts.

## Implementation phase

Phase 1.6.
