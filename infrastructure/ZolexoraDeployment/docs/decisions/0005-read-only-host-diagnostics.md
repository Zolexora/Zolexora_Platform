# ADR 0005: Read-only host diagnostics

## Status

Accepted

## Context

Installation must not begin until the host can be assessed safely. Prerequisite discovery needs a deterministic, provider-neutral interface that reveals actionable classifications without leaking host identity or changing state.

## Decision

DP-05 implements diagnostics in the non-executable `core/lib/diagnostics.sh` library and activates only the root `doctor.sh` command. Diagnostics remain read-only and fixed to eleven ordered checks: operating system, required commands, capacity, filesystem, Docker, Docker Compose, Nginx, systemd, listeners, time synchronization, and DNS.

Checks return `pass`, `warning`, or `critical`; the worst status wins. Command exits are 0 for pass, 1 for warnings only, 2 for any critical result, 64 for invalid usage, and 70 for internal failure. Deterministic text and JSON contain normalized summaries, omit host identifiers and raw command output, and always state that production readiness is false.

`/etc/os-release` is parsed literally rather than sourced. Ubuntu 24.04 LTS and 26.04 LTS are supported. `/data` is inspected without a write probe. Listener inspection excludes process data and addresses, and DNS inspection is limited to resolver configuration plus local `localhost` resolution; no external query occurs. Fixture paths exist only in tests and are not production CLI options. No diagnostic installs, repairs, configures, starts, stops, or remediates anything. This behavior remains provider-neutral core; provider adapters are neither selected nor invoked by host inspection.

## Consequences

Prerequisite gaps can be reported before installation without provider coupling or host mutation. Development hosts may legitimately fail checks. Passing diagnostics neither proves application capacity nor certifies production readiness. Installation planning and filesystem ownership policy remain later work.

## Alternatives considered

- Source `/etc/os-release`: rejected because host data would execute as shell code.
- Add remediation to the diagnostic command: rejected because inspection and mutation require separate authorization and transaction boundaries.
- Probe external DNS or services: rejected because DP-05 must not contact networks.
- Expose fixture overrides in production: rejected because test controls must not expand the operational interface.
