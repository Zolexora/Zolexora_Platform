# ADR 0002: Immutable releases

## Status

Accepted

## Context

Mutable production updates make rollback, audit, and reproduction unreliable.

## Decision

Application CI builds OCI images and identifies them immutably, normally by Git commit SHA or digest. The production server pulls images and never builds application source. The mutable `latest` tag is prohibited.

Deployment runs migrations, applies the selected Compose release, and passes a health gate before success. Failure triggers or enables rollback to the last known healthy release. The mutable `update.sh` entry point was removed; all application changes use `deploy.sh` with an immutable release identifier.

## Consequences

Release metadata must preserve current and previous immutable identities. Migration compatibility and rollback constraints must be explicit. CI and registry retention must preserve deployable releases.

## Alternatives considered

- Build on the production server: rejected because inputs and tooling are harder to reproduce and secure.
- Update running source or use mutable tags: rejected because the deployed artifact cannot be proven or reliably rolled back.
