# ADR 0003: Root command boundary

## Status

Accepted

## Context

Operators and automation need a small stable interface without duplicate wrappers or provider-specific commands disguised as core operations.

## Decision

The canonical public commands are:

```text
install.sh
deploy.sh
rollback.sh
backup.sh
restore.sh
verify-backup.sh
healthcheck.sh
doctor.sh
```

Root commands are stable public entry points. Internal functions belong in `core/lib/`; adapter executables remain inside their adapter implementation. Duplicate wrappers are prohibited. `update.sh` was removed because deployments are immutable.

## Consequences

Automation has one documented entry point per operation. Internal refactoring can occur without adding aliases. Root commands remain fail-closed until their implementation phases.

## Alternatives considered

- Duplicate commands under `bin/` or `scripts/`: rejected because ownership and behavior would diverge.
- Keep a mutable update alias: rejected because it conflicts with immutable release semantics.
