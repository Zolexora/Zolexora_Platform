# ADR 0006: Canonical repository layout

- Status: Accepted
- Date: 2026-07-14

## Context

Historical product folders obscured shared portal and service ownership. Phase 1 made package discovery deterministic but retained those paths.

## Decision

Storefronts live under `apps/storefronts/`, shared portals under `apps/portals/`, FastAPI under `services/marketplace-api/`, deployment assets under `infrastructure/`, shared packages under `packages/`, and project knowledge under `project/`. ADR 0007 refines mobile ownership by placing buyer apps under storefronts and seller mobile under the seller portal. Root pnpm and its lockfile remain authoritative.

## Reasons

The layout exposes permanent ownership and separates transitional Mahila code from the permanent storefront.

## Consequences

Active tooling must use canonical paths. Mahila `legacy-server/` remains functional but transitional. Historical audits may retain old paths. The future storefront-context decision is ADR 0008.

## Alternatives considered

- Keep historical product folders: rejected because ownership stayed unclear.
- Rewrite applications by framework: rejected because Phase 1.5 is path-only.

## Affected modules

Workspace discovery, package identities, CI, Compose, Dockerfiles, assets, FastAPI working directories, and documentation.

## Implementation phase

Phase 1.5.
