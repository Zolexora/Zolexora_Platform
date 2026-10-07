# ADR 0009: Application deployment contract

## Status

Accepted

## Context

The deployment repository owns Marketplace runtime policy but must not inspect application source to guess service names, ports, commands, or storage. Existing contracts confirm Docker Compose, immutable OCI images, PostgreSQL-compatible and Redis-compatible connectivity, object-storage configuration, private data traffic, and Nginx as the future public boundary. They do not establish concrete Marketplace services or whether stateful dependencies are locally composed.

## Decision

`applications/marketplace/compose.yaml` is the sole Marketplace Compose contract. It is intentionally a valid empty-service model until application owners provide authoritative role, port, health, migration, configuration, secret, state, and resource inputs. An empty service set is fail-closed: it cannot deploy a guessed application.

Future application services must use explicit OCI registry repositories pinned by lowercase SHA-256 digest. Builds, mutable tags, `latest`, implicit registries, and registry credentials in configuration are forbidden. A migration role may exist only after its real application-owned command is supplied; when API-owned, it must use the identical immutable API image, run once without restart, and be serialized to one runner per release.

The network zones are `edge`, `application`, and `data`. Application and data networks are internal. Frontends may not join the data network; only confirmed services may receive memberships. DP-10 owns the Nginx/TLS handoff and may not be anticipated with a host port in DP-09.

Secrets are explicit read-only files from the future protected runtime secret directory. Secret values never enter Git, environment examples, commands, labels, health checks, logs, or persistent volumes. Exact keys remain application-owned unresolved inputs. Stateless services receive no persistent volumes. Stateful placement and volume ownership remain unresolved; no local database, cache, upload, or object-storage volume is invented.

Long-running services must drop all capabilities, enable no-new-privileges, avoid privilege and host namespaces, use read-only roots with explicit temporary storage, use bounded PID/resource inputs, and define an image-owned exec-form readiness check. Logging uses the local driver with bounded rotation inputs; DP-14 owns monitoring and aggregation.

Validation is configuration-only and offline. It parses the YAML, validates the non-production example through existing literal configuration and immutable-image helpers, and may run `docker compose config --quiet`. It never creates a container, network, or volume.

## Consequences

DP-09 records one provider-neutral deployment boundary without fabricating application behavior. It remains blocked on authoritative Marketplace roles, ports, image variables, health and migration commands, stateful-service placement, volume requirements, configuration and secret keys, resource limits, and the DP-10 edge handoff.

DP-09 does not deploy applications. Compose must not be executed before DP-10 and DP-11 are completed and reviewed. Nginx/TLS is deferred to DP-10, deployment/rollback to DP-11, image build/publish to DP-12, backup/restore to DP-13, and monitoring/logging to DP-14. Passing this contract does not certify production readiness.

## Alternatives considered

- Guess concrete Marketplace services or commands: rejected because the application contract is not authoritative here.
- Inspect the application source repository: rejected by the repository ownership boundary.
- Compose PostgreSQL or Redis now: rejected because local versus managed ownership is unresolved.
- Publish placeholder host ports: rejected because ports and the DP-10 edge handoff are unresolved.
