# Environment and filesystem contract

## Machine and trust boundaries

This repository is developed on a development machine but manages production deployment contracts. Development, staging, and production are separate machines and separate trust boundaries. The current implementation focus is production; development and staging deployment automation is out of scope.

Production values and secrets never come from development `.env` files. Under the initially selected CI adapter, generated production configuration receives non-secret values and secrets from a protected GitHub production Environment. Future adapters must provide an equivalent protected boundary.

Normal production changes are generated and applied by automation. Manual production edits create configuration drift and are prohibited. Emergency changes follow the controlled access and reconciliation process in `security.md`.

The provider may change without altering the core application contract. A provider supplies Ubuntu, storage, networking, and authorized SSH/sudo access; provider-specific provisioning remains an optional adapter concern.

## Canonical production filesystem

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

| Path | Contract |
|---|---|
| `/data/projects/<application>/` | Generated deployment configuration, immutable release identity, and current/previous release state |
| `/data/secrets/` | Protected runtime secrets with restrictive ownership and permissions |
| `/data/backups/` | Local backup staging, manifests, checksums, and verification evidence |
| `/data/logs/` | Deployment and operational logs subject to retention and rotation |
| `/data/ssl/` | Origin TLS state where required by the selected TLS adapter |
| `/data/scripts/` | Installed, version-controlled operational entry points |

Persistent application data must not be stored inside a checked-out Git repository. Application volumes and external storage locations must be explicit and independently recoverable.

## Path safety

Core paths must be configurable, canonicalized, and validated before any mutation. No script may recursively delete or overwrite `/data`, `/`, a home directory, an empty value, or an unresolved path. Application identifiers and path inputs must be constrained before being combined with the `/data` root.

DP-06 formalizes these exact paths in `core/install/filesystem-layout.tsv` without creating or modifying them. No additional direct `/data` child is authorized.

## DP-05 host inspection

DP-05 recognizes Ubuntu 24.04 LTS and Ubuntu 26.04 LTS. `doctor.sh` inspects `/data` and only the six documented direct managed directories without creating or changing them. CPU, memory, and available disk thresholds are prerequisite diagnostic baselines, not Marketplace sizing or production capacity certification. No development, staging, or production host is modified, and a development host may legitimately report warnings or critical prerequisites.

## DP-06 ownership and permissions

The manifest uses policy roles rather than host account names. `/data` and `/data/scripts` are administrator-managed. Other direct children use a future deployment-service role whose concrete identity is unresolved. Modes are `0755` for `/data` and scripts, `0750` for projects, backups, and logs, and `0700` for secrets and TLS state. World-writable paths and symlinks are prohibited. Existing conflicts are blockers; DP-06 performs no remediation or write probe.

## DP-07 isolated execution

DP-07 maps logical managed paths into an exact marked test root created directly below `/tmp`. It may create and clean only that disposable tree. The repository, host `/data`, home directories, package databases, identities, and services are outside the mutation boundary. DP-08 qualified that behavior in guarded disposable containers. DP-09 adds only a configuration contract and does not modify any development, staging, or production environment.
