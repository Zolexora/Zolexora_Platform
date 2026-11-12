# ADR 0005: Canonical pnpm workspace

- Status: Accepted
- Date: 2026-07-14

## Context

The root workspace previously matched only `apps/*`, while every active application is nested more deeply. The lockfile, CI, and Docker files referenced obsolete flat paths, allowing Turbo to report success while running zero application tasks. Mahila also used three nested npm lockfiles.

## Decision

pnpm is the single JavaScript package manager and the root `pnpm-lock.yaml` is the sole lockfile. Every active JavaScript application belongs to the explicit root workspace. The Mahila wrapper manifest is not a third application; root scripts replace its convenience orchestration. Root checks run `verify:workspace`, and Turbo success is invalid unless every required package is present at its canonical path.

## Reasons

One package graph makes local, CI, and container installs reproducible. Explicit paths prevent generated or wrapper directories from becoming packages accidentally. A preflight guard prevents zero-task false greens.

## Consequences

Mahila client/server packages use pnpm and no longer own npm lockfiles. Adding, removing, or renaming an active application requires updating the workspace guard, workspace file, lockfile, CI/Docker references, and this documentation. ADR 0006 supersedes the historical physical-layout portion of this decision.

## Alternatives considered

Independent npm islands (rejected: multiple lock owners); broad recursive workspace globs (rejected: ambiguous wrapper/generated ownership); moving all applications in Phase 1 (rejected: unnecessary source churn).

Affected modules: repository tooling, all JavaScript applications, shared packages, CI, Docker. Implementation: Phase 1.
