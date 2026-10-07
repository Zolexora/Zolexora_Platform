# ADR 0006: Filesystem and installation planning

## Status

Accepted

## Context

Installation cannot be authorized until filesystem state, package capabilities, exact-version policy, idempotency, and transaction boundaries are deterministic and reviewable. DP-05 diagnosed prerequisites but left ownership and installation policy unresolved.

## Decision

The managed root remains `/data` with exactly six direct children established before DP-05: `/data/projects`, `/data/backups`, `/data/logs`, `/data/secrets`, `/data/ssl`, and `/data/scripts`. Their purposes remain release state, backup staging and evidence, operational logs, runtime secrets, origin TLS state, and installed operational entry points.

`core/install/filesystem-layout.tsv` is canonical desired state. `/data` and scripts use the `administrator` policy role and mode `0755`. Projects, backups, and logs use the unresolved `deployment-service` role and mode `0750`. Secrets and TLS state use that role and mode `0700`. Role labels are not account names; no identity is created. Symlinks and world-writable modes are prohibited. Scripts are published-immutable, projects release-mutable, backups and logs shared-mutable, and secrets and TLS state restricted-mutable.

Future files use `0640`, protected secrets and private keys use `0600`, scripts use `0755`, and mutation uses umask `0027`. Temporary paths must be operation-scoped within an authorized managed subtree. Mounts may back the root or a child, so cross-filesystem atomicity is not assumed. Existing type, ownership, or mode conflicts block; no automatic ownership change or cleanup occurs.

`core/install/ubuntu-packages.tsv` supports Ubuntu 24.04 and 26.04. It maps Bash and local utilities, NSS, socket inspection, systemd and time synchronization, CA certificates, Git, Nginx, Docker Engine and CLI, containerd, Buildx, and Compose v2 to packages. Buildx is optional because production hosts pull CI-built images; the Docker runtime and Compose v2 remain required. Legacy Compose, `docker.io`, Podman, and snap packages are not substitutes. Exact versions must be approved before application; `latest` and other mutable package references, automatic major upgrades, and automatic downgrades are prohibited.

Ubuntu-archive packages have a source classification but no invented endpoint. Docker package-source identity and signing-key fingerprint remain unresolved critical blockers. No source, key, candidate version, or repository URL is fetched. Local `dpkg-query` data may be read; `apt update` and network package queries are prohibited.

`install.sh` is activated only with `--dry-run`. It renders ten ordered steps: host diagnostics, filesystem contract, existing filesystem state, service identity, required packages, package versions, package sources, idempotency, transaction boundaries, and execution authorization. Results use pass, warning, or critical and deterministic text or JSON. Application authorization, host modification, and production readiness are always false.

Identical inspected state produces byte-identical plans. Correct future state would remain unchanged. Partial installation, conflicting paths, unsafe symlinks, incompatible policy, unknown state, unapproved major versions, and unresolved sources fail closed. No plan depends on associative-array iteration order.

Future transaction boundaries are repository, OS, source and version, service identity, root, full layout, immutable plan, explicit authorization, package application, filesystem application, service validation, and completion evidence. DP-06 implements only the first seven as read-only planning. Critical blockers prevent continuation. There is no automatic cleanup or rollback; recovery requires a separately authorized and tested phase.

## Consequences

Installation intent is reviewable and provider-neutral without changing a host. Concrete service identity, Docker source trust, exact versions, candidate metadata, and applying behavior remain unresolved. Passing a plan does not authorize installation or certify production readiness.

## Alternatives considered

- Install while discovering prerequisites: rejected because mutation would precede a complete plan.
- Use current usernames or ownership: rejected as host-specific and non-reproducible.
- Accept distribution Docker substitutes or legacy Compose: rejected because Docker Engine with Compose v2 is required.
- Refresh package metadata or fetch source keys during planning: rejected because DP-06 is local and network-free.
