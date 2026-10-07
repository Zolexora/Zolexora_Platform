# ZolexoraDeployment

`ZolexoraDeployment` is the production-only deployment framework shared by Zolexora products. It defines a provider-neutral contract for configuring supported Ubuntu servers and operating applications through Docker Compose.

> **Production-readiness warning:** DP-09 defines a non-executing Marketplace Compose contract, but authoritative application services and commands remain unresolved. Public host installation and deployment remain disabled. No health gate, rollback, backup, restore, monitoring, or CI/CD operation is implemented.

## Architecture

The provider supplies a supported Ubuntu LTS server, persistent storage, networking, SSH access, and root or passwordless sudo access. This framework will supply validated server setup, Docker Engine and Compose, Nginx, firewall policy, TLS automation, deployment, rollback, backup, recovery, health monitoring, and log rotation.

Core logic depends only on standard interfaces: Ubuntu, Bash, SSH, Docker, Docker Compose, Nginx, HTTP health endpoints, OCI registries, PostgreSQL-compatible and Redis-compatible connections, and replaceable backup destinations. Cloud or service APIs belong in adapters and must not be called directly by core scripts.

Initially selected integrations are:

- GitHub Actions for CI/CD
- Cloudflare for DNS, proxy, CDN, and WAF
- Let's Encrypt for origin TLS by default
- SSH for automated deployment transport
- Any OCI-compatible registry for application images
- Local backup staging plus a configurable off-server destination
- Marketplace as the first application deployment target

These integrations are selected adapters, not mandatory core dependencies.

Canonical ownership is now tracked under `core/`, `adapters/`, `applications/`, `.github/`, `nginx/`, `firewall/`, `systemd/`, `templates/`, and `tests/`. The root scripts remain the only public operational commands. One fail-closed Marketplace Compose contract exists; no runnable Compose project or GitHub Actions workflow exists.

DP-04 added the shared Bash foundation, DP-05 added read-only diagnostics, and DP-06 added declarative filesystem/package planning. DP-07 added an execution engine reachable only from tests, and DP-08 qualified it offline in guarded containers. DP-09 adds one fail-closed Marketplace Compose contract under `applications/marketplace/`; its empty service set records unresolved application-owned inputs rather than guessing them. `doctor.sh` and `install.sh --dry-run` remain the only operational public surfaces.

## Production flow

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

Users reach applications through Cloudflare using Full (strict) TLS, then Nginx on the provider-supplied Ubuntu server, and finally Docker Compose services. Only Nginx may expose public HTTP or HTTPS ports. PostgreSQL and Redis must remain private.

## Production filesystem contract

```text
/data/
├── projects/
│   └── <application>/
├── backups/
├── logs/
├── secrets/
├── ssl/
└── scripts/
```

- `projects/<application>/` holds generated deployment configuration and release state.
- `secrets/` holds protected runtime secrets.
- `backups/` holds local staging data and verification evidence.
- `logs/` holds rotated deployment and operational logs.
- `ssl/` holds origin TLS state where required.
- `scripts/` holds installed, version-controlled operational entry points.

Persistent application data must not live in a checked-out Git repository. Core paths will be configurable and safely validated before use.

## Root commands

| Command | Responsibility | Current behavior |
|---|---|---|
| `install.sh` | Plan supported Ubuntu installation | Dry-run only; no arguments fail closed |
| `deploy.sh` | Deploy an immutable application release | Fails closed |
| `rollback.sh` | Return to the last healthy immutable release | Fails closed |
| `backup.sh` | Create a consistent encrypted backup | Fails closed |
| `restore.sh` | Restore verified backup data | Fails closed |
| `verify-backup.sh` | Verify backup integrity and evidence | Fails closed |
| `healthcheck.sh` | Evaluate deployment and application health | Fails closed |
| `doctor.sh` | Inspect local host prerequisites | Operational, read-only |

`doctor.sh` retains its DP-05 interfaces. `install.sh --dry-run`, with optional `--format text|json`, evaluates ten fixed planning steps. Result exits are `0` for pass, `1` for warnings, `2` for critical blockers, `64` for invalid usage, and `70` for internal failure. `install.sh` without arguments exits `78`. Applying, installing, fixing, repairing, or executing a plan is unavailable. The other six commands remain fail-closed.

## Roadmap

- **DP-02:** architecture, security, filesystem, and fail-closed command contracts — complete
- **DP-03:** canonical tracked structure and provider-neutral interfaces — complete
- **DP-04:** provider-neutral shared Bash foundation — complete
- **DP-05:** safe host inspection and prerequisite diagnostics — complete
- **DP-06:** filesystem-layout and installation planning without host mutation — complete
- **DP-07:** isolated installer execution and recovery testing — complete; final verdict PASS after Ubuntu 24.04 and 26.04 disposable validation on a confirmed development/test machine
- **DP-08:** offline pre-production installer qualification in explicitly authorized disposable Ubuntu environments — complete
- **DP-09:** provider-neutral Marketplace application deployment contract — complete with unresolved application inputs; no deployment
- **DP-10:** Nginx and TLS — unimplemented
- **DP-11:** deployment and rollback — unimplemented
- **DP-12:** GitHub Actions image build/publish automation — unimplemented
- **DP-13:** backup and restore — unimplemented
- **DP-14:** monitoring and logging — unimplemented
- **DP-15 through DP-18:** automated validation, production rehearsal, migration/operations, and release certification — unimplemented

Each later capability must be implemented and validated in a bounded phase before production use.

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — component ownership and adapter boundaries
- [`docs/security.md`](docs/security.md) — threat model and production security rules
- [`docs/environments.md`](docs/environments.md) — machine and trust-boundary model
- [`docs/backup-and-restore.md`](docs/backup-and-restore.md) — data-protection policy
- [`docs/disaster-recovery.md`](docs/disaster-recovery.md) — recovery contract
- [`docs/migration-runbook.md`](docs/migration-runbook.md) — future server migration order

## Contributing safely

Read `AGENTS.md` before changing the repository. Reuse existing responsibilities, keep core behavior provider-neutral, and put integrations behind adapters. Never commit runtime secrets or mutable production image references. Do not run production operations, contact infrastructure, commit, or push unless explicitly authorized.
