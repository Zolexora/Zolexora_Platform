# Architecture contract

## Status and goals

DP-09 defines a non-executing Marketplace application deployment contract with unresolved application-owned inputs; it does not expose host installation or deploy an application.

The goals are immutable releases, repeatable host configuration, health-gated rollback, explicit trust boundaries, replaceable integrations, recoverable data, and no normal manual editing in production.

## Provider-neutral core

Core logic may depend on supported Ubuntu LTS, POSIX-compatible shell behavior and Bash, SSH, Docker Engine, Docker Compose, Nginx, standard HTTP health endpoints, OCI-compatible registries, PostgreSQL-compatible connections, Redis-compatible connections, and replaceable local or remote backup destinations.

Core scripts must not directly call AWS, OCI, Azure, GCP, GitHub, GitLab, Cloudflare, provider metadata, object-storage, or DNS APIs. EC2, OCI Compute, Azure VM, GCP Compute Engine, or a generic VPS may provide the Ubuntu server without changing core behavior.

Core paths must be configurable, resolved, and validated. No core operation may treat an empty, root, home-directory, or unresolved path as a destructive target.

## Replaceable adapters

Adapters translate an external service into a stable core contract. Initially selected adapters are GitHub Actions for CI/CD, Cloudflare for DNS/proxy/CDN/WAF, Let's Encrypt for origin TLS, SSH for deployment transport, any OCI-compatible registry, and local backup staging plus a configurable off-server destination. Marketplace is the first application adapter target.

An adapter may authenticate to its service and use service APIs. It must pass only validated results or configuration to core operations and must not leak provider assumptions into shared scripts.

## Canonical repository ownership

- Root scripts are the only public operational entry points.
- `core/` owns provider-neutral implementation; future shared Bash libraries belong in `core/lib/`.
- `adapters/` owns replaceable external-service integrations.
- `applications/` owns deployment contracts, not application source.
- `.github/` owns the selected GitHub Actions boundary; workflows are deferred to DP-12.
- `nginx/`, `firewall/`, `systemd/`, and `templates/` own their future generated configuration and operational contracts.
- `tests/` owns deterministic local validation and later integration layers.

The foundation includes read-only installation planning plus test-only isolated execution. Declarative manifests under `core/install/` retain logical `/data` state. DP-08 wraps that engine with guarded offline qualification. DP-09 owns one Marketplace Compose contract under `applications/marketplace/`; its empty service set prevents guessed application behavior while recording immutable-image, network, secret, state, health, migration, hardening, and handoff requirements. Root commands cannot invoke installation, qualification, or application execution. Provider adapters, host installation, and deployment remain unimplemented.

Duplicate public wrappers are prohibited. The mutable update entry point was removed; immutable application changes use `deploy.sh` with an explicit release identifier.

## Responsibilities

| Component | Responsibility |
|---|---|
| Provider | Supply a supported Ubuntu server, persistent storage, networking, SSH, and root or passwordless sudo access |
| GitHub Actions | Validate and test changes, build immutable images, publish them, authorize production, and invoke deployment over verified SSH |
| Registry | Store and serve immutable OCI images identified by digest or commit-SHA tag |
| Deployment framework | Validate the host and inputs, generate deployment configuration, pull releases, run migrations, apply Compose, health-gate, roll back, back up, restore, and record evidence |
| Nginx | Be the only public origin HTTP/HTTPS listener and reverse proxy requests to private application services |
| Application Compose project | Define application services, private networks, health checks, persistent mounts, dependencies, logging limits, and image references |
| Database | Provide PostgreSQL-compatible persistence on a private network and participate in consistent backup/restore procedures |
| Redis | Provide a private Redis-compatible service with no public port exposure |
| Object/persistent storage | Preserve application data independently of a checked-out Git repository |
| Cloudflare | Provide the selected DNS, proxy, CDN, and WAF adapter using Full (strict) TLS |
| Backup adapter | Copy encrypted backup artifacts and verification metadata to a configured off-server destination |

## Trust boundaries

- A development machine may author code but does not supply production runtime values.
- GitHub Actions uses a protected production Environment as the initial authorization boundary.
- The OCI registry is trusted to deliver the requested immutable digest or tag; credentials are scoped and secret.
- SSH crosses into the production server only with verified host keys and a restricted deployment identity.
- Nginx is the public origin boundary. Compose application, PostgreSQL, and Redis networks remain private.
- Cloudflare terminates user-facing TLS and verifies a valid origin certificate using Full (strict).
- Backup destinations are separate trust domains with independent credentials and authorization.

## CI/CD and release flow

```text
Developer push
    ↓
GitHub repository
    ↓
GitHub Actions validation and tests
    ↓
Build immutable OCI container images
    ↓
Push images to a configurable OCI registry
    ↓
SSH-based automated deployment
    ↓
Docker Compose pull and deploy
    ↓
Database migrations
    ↓
Health gate
    ↓
Success or automatic rollback
```

Application source is built only in CI. The production host pulls an immutable image, normally tagged with the Git commit SHA; mutable production tags are forbidden. A release record must preserve the image identity and enough generated configuration to restore the prior healthy release.

## Network flow

```text
Users
    ↓
Cloudflare DNS / Proxy / CDN / WAF
    ↓
HTTPS using Full (strict)
    ↓
Provider-supplied Ubuntu server
    ↓
Nginx reverse proxy
    ↓
Docker Compose applications
    ↓
PostgreSQL, Redis and persistent/object storage
```

Only Nginx may publish origin HTTP/HTTPS ports. Databases, Redis, and application-internal ports must use private Compose networks or local-only bindings.

## Docker Compose and application boundary

Docker Compose is the sole production application runtime. The framework owns deployment sequencing, validated inputs, shared edge contracts, release state, and operational policy. Each application owns its Compose service definition, migration command, health endpoint, required persistent data, and documented configuration keys.

The deployment repository must not inspect an application repository to guess these values. Application contracts are supplied explicitly in tracked definitions. DP-09 therefore keeps Marketplace services empty until authoritative roles, ports, image variables, health commands, migration commands, state ownership, configuration, secrets, and resources are supplied.

The Marketplace network zones are project-scoped `edge`, internal `application`, and internal `data`. No membership is assigned until service roles and ports are authoritative. PostgreSQL-compatible, Redis-compatible, and object-storage interfaces are confirmed, but local versus managed placement and persistent volume ownership remain unresolved. DP-10 owns the reverse-proxy handoff; DP-11 owns execution and health gating.

## Configuration and secrets

Configuration is non-sensitive behavior or metadata that is safe to review and version. Secrets authenticate, authorize, decrypt, or expose private data. Runtime secrets are supplied through protected automation, stored under `/data/secrets/` with restrictive permissions, and never committed or printed.

Generated deployment configuration belongs under `/data/projects/<application>/`, not in a source checkout. Production changes are generated and applied through automation; manual edits create prohibited drift.

## Health-gated rollback

A future deployment is successful only after migrations and defined internal and public health checks pass. Failure must trigger or enable automatic rollback to the last known healthy immutable release. Migration compatibility and data recovery requirements must be explicit when application rollback alone is unsafe.

## Future scaling path

The initial design targets one Ubuntu server without embedding that topology into application contracts. Scaling may later replace the server, registry, backup, DNS, TLS, or infrastructure adapter, or add multiple application hosts. Core inputs and health/release contracts must remain stable; new abstraction is added only when a concrete second implementation requires it.
