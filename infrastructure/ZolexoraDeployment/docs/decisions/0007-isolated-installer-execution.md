# ADR 0007: Isolated installer execution

## Status

Accepted

## Context

DP-06 made installation intent deterministic but intentionally left every applying operation disabled. Applying logic still needs failure, idempotency, and recovery testing before any non-test host can be considered. Such testing must not reach host `/data`, package databases, identities, services, or the network.

## Decision

DP-07 implements the execution engine in `core/lib/installer-execution.sh` for test use only. Root commands do not source it, and `install.sh --apply` remains invalid. The library translates logical `/data` paths into a validated disposable root created as `/tmp/zolexora-dp07.XXXXXX`; the root must be canonical, owned by the test process, mode `0700`, directly below `/tmp`, free of symlinks and unsafe characters, outside the repository/workspace/current/home paths, and contain a regular mode-`0600` marker with the exact DP-07 marker value. A copied marker cannot bypass these checks.

The immutable TSV plan has sequence, id, action, target, expected-before, desired-after, reversibility, and failure policy. It contains exactly ten ordered steps: context validation, resolved-plan validation, transaction initialization, package-state simulation, service-identity-policy simulation, filesystem layout application, postcondition verification, completion recording, recovery-state evaluation, and finalization. SHA-256 of canonical plan serialization identifies the plan; this is deterministic identity, not an authenticity claim.

Package changes are simulated through validated fixture state inside the disposable root. No package manager runs. Identity and ownership are normalized policy metadata; no host account is created and no raw identifier is reported. Filesystem execution creates only translated `/data` and its six accepted children, applies manifest modes, blocks conflicts, extra children, symlinks, and unsafe layouts, and is idempotent.

The journal is atomically replaced within the isolation root and contains only contract version, transaction state, plan digest, last completed sequence, step id/status, and safe summary. It has no timestamp or host data. Completion is recorded only after postconditions pass. Fixed test-only failure points cover every mutation boundary and each child creation. Partial, malformed, mismatched, and unknown states fail closed. Recovery output preserves state and requires manual review; automatic recovery, cleanup, rollback, or resume is not implemented.

Text and JSON reports are deterministic, omit temporary paths and host identifiers, and always deny production apply, host data/package mutation, and production readiness. Disposable Ubuntu validation may run only after explicit development/test host classification, with exact local Ubuntu 24.04 and 26.04 images, pulls disabled, networking disabled, all capabilities dropped, a read-only repository mount, and no sensitive host mount. No image is pulled and no real package is installed.

## Consequences

The mutation and recovery mechanics are testable without authorizing host installation. The simulation does not prove real apt behavior, source trust, account provisioning, or service activation. DP-07 concluded with PASS after explicit development/test classification and successful Ubuntu 24.04 and 26.04 disposable validation. No DP-07 disposable-validation blocker remains. Successful isolated testing does not authorize production mutation or installation, does not certify production readiness, and does not implement DP-08.

## Alternatives considered

- Expose `install.sh --apply` against a temporary root: rejected because a public apply surface would blur the production boundary.
- Rewrite the production manifest with temporary paths: rejected because logical desired state must remain stable.
- Test real apt or identity creation on the development host: rejected because it mutates host trust and package state.
- Auto-delete or roll back partial state: rejected because unknown and conflicting states require separately authorized recovery.
