# Marketplace deployment contract

Marketplace is the first deployment target. DP-09 owns its sole Compose contract at `compose.yaml`; application source remains outside this repository. The Compose model is intentionally valid with zero services because no authoritative service names, ports, image variables, health commands, migration command, or stateful-service placement exists here. This is a fail-closed contract, not a deployable stack.

## Required application-owned inputs

Before a service may be added, its owner must provide its canonical role and Compose identifier, digest-qualified OCI image variable, internal port, image-owned exec-form readiness command, non-secret configuration keys, read-only secret-file keys, network memberships, temporary and persistent state, PID/resource limits, and rollback compatibility. Background work may be added only when its worker or scheduler role is confirmed.

PostgreSQL-compatible connectivity, Redis-compatible connectivity, and object-storage configuration are required interfaces, but local versus externally managed ownership is unresolved. No database, cache, upload, or object-storage service or volume is defined. Frontends and portals may never join the restricted data network unless a later accepted application contract explicitly requires it.

Every application image must be supplied as an explicit repository-qualified `@sha256:` reference with a lowercase 64-character digest. Tags alone, `latest`, builds, implicit registries, and credentials in Compose are forbidden. `config.example` contains only an unmistakable reserved example and is never loaded automatically.

Secrets must be future files under the protected runtime secret boundary, mounted read-only and kept out of configuration, commands, labels, logs, health checks, and persistent volumes. Exact secret keys and paths are unresolved; DP-09 does not invent them or read secret content.

The network zones are project-scoped `edge`, internal `application`, and internal `data`. DP-10 owns the reverse-proxy handoff and must resolve how host Nginx reaches the edge zone without a public application port. DP-11 owns application deployment, serialized migration execution, health gating, and rollback. The migration command is unresolved and no migration service is defined.

Long-running services must drop all capabilities, use no-new-privileges, run without privilege or host namespaces, use read-only roots with explicit temporary storage, define bounded PID/resource inputs, use bounded local-driver logging, and restart unless stopped. Health must prove application readiness through an image-owned exec-form command; a process check or open TCP port alone is insufficient.

No Compose execution is authorized. Configuration may be parsed or checked with `docker compose config --quiet`; it must not be built, pulled, created, started, run, executed, or migrated. DP-10 through DP-14 remain deferred, and production readiness remains false.
