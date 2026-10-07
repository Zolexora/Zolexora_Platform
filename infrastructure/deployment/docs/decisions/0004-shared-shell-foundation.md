# ADR 0004: Shared Bash foundation

## Status

Accepted

## Context

Future operational commands need identical handling of errors, logs, inputs, paths, configuration, locks, and immutable releases. Duplicating those safety rules across root commands would cause drift and inconsistent failure behavior.

## Decision

Shared provider-neutral Bash libraries live under `core/lib/`; stable public commands remain at the repository root. Public functions use `dp_`, private helpers use `dp__`, and libraries are sourced with mode `100644`.

Sourcing has no output, file, network, lock, configuration-read, working-directory, shell-option, or trap side effect. Configuration is parsed as allowlisted literal data and is never sourced or evaluated. Paths require explicit allowed roots, and destructive-target validation is mandatory. Local locking uses bounded `flock`. Release metadata requires immutable release and image identifiers. Secret-classified values are never logged. Provider-specific behavior stays outside core.

Unit and contract tests are mandatory for shared behavior.

## Consequences

Later commands can reuse one tested safety boundary. Callers must pass explicit configuration, paths, timestamps, and release identities. The libraries do not install software, activate releases, persist metadata, or perform production operations.

## Alternatives considered

- Duplicate helpers in each root command: rejected because security and error behavior would diverge.
- Source configuration as shell code or use `eval`: rejected because data could execute code.
- Unbounded locks or implicit paths: rejected because failure could hang or target unsafe locations.
- A new external framework: rejected because Bash and standard Ubuntu tools satisfy the bounded foundation.
