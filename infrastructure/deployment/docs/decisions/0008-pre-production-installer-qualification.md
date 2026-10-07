# ADR 0008: Pre-production installer qualification

## Status

Accepted

## Context

DP-07 proved installer transaction mechanics with simulated packages in marked temporary roots. Before any later staging-host mutation can be considered, the same engine must be exercised with real offline package tooling while preserving the public installation prohibition and all container isolation controls.

## Decision

DP-08 adds one explicitly opted-in integration harness at `tests/integration/preproduction-installer-qualification-test.sh`. It is not a public installer. The harness runs only inside exact locally available Ubuntu 24.04 and 26.04 images with pulls and networking disabled, all capabilities dropped, no-new-privileges, read-only container and repository filesystems, disposable `/tmp` and `/qualification` tmpfs storage, and no sensitive host mounts.

The inner qualification requires the exact test-only opt-in, Docker-container evidence, a read-only `/workspace` mount, supported literal-parsed OS-release data, and the existing marked DP-07 isolation-root validation. Empty, relative, broad, home, repository, unresolved, and symlinked roots fail before installer mutation. Root commands do not source or invoke qualification or execution functions.

Each container builds a deterministic inert `zolexora-installer-qualification` Debian package using its already-present `dpkg-deb`. The package contains one text payload, no maintainer scripts, services, credentials, or executables. It is unpacked only under disposable qualification storage and never enters the container or host package database. No package repository is configured, refreshed, or contacted.

The harness reuses the DP-07 immutable plan, executor, filesystem contract, simulated production-package boundary, atomic journal, failure injection, partial-state detection, recovery-plan generation, and DP-04 `flock`. It qualifies first execution, idempotent replay, deterministic evidence, conflicts, symlink escape, malformed input, package-version conflict, interruption, recovery classification, same-root contention, distinct-root independence, and stale lock-file reuse. Recovery remains advisory and never executes automatically.

## Consequences

Both supported Ubuntu environments can qualify the internal engine offline without installing a host or production package. Generated packages, journals, locks, and filesystem state disappear with their containers. Passing DP-08 does not test application deployment, authorize host or production mutation, enable `install.sh --apply`, or certify production readiness. A separate phase and explicit approval are required before any installer is exposed outside disposable qualification.

## Alternatives considered

- Add a public temporary-root apply option: rejected because it would expose production-adjacent mutation through a root command.
- Install a real repository package: rejected because qualification must remain offline and source-independent.
- Add a second package executor: rejected because `dpkg-deb` qualification can wrap the accepted DP-07 engine without duplicating its planning, journaling, or recovery architecture.
- Make the repository or container root writable: rejected because disposable tmpfs storage is sufficient.
