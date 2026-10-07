# Installation planning contract

DP-06 defines desired state and read-only planning only. It never installs packages, creates identities or paths, changes permissions, starts services, contacts package sources, or authorizes application.

## Filesystem policy

`filesystem-layout.tsv` contains `/data` and exactly the six previously documented direct children. `administrator` and `deployment-service` are policy roles, not host usernames or groups. The administrator role owns the boundary and published scripts. The future deployment-service role may write release state, backups, logs, secrets, and TLS state according to the manifest; its concrete account and group remain an unresolved prerequisite.

Directories use the exact manifest modes. Future regular files default to `0640`; secret and private TLS files use `0600`; published scripts use `0755`. Future mutation must use umask `0027`. Temporary state must be operation-scoped inside an authorized managed subtree, use `0700` directories and `0600` files, and never introduce another direct `/data` child.

Symlinks are prohibited in the managed layout. Persistent mounts may back `/data` or a direct child, but code must not assume paths share a filesystem; atomic rename is valid only within one filesystem. Ownership or mode differences, conflicting files, unsafe symlinks, and partial prior installation block future application. DP-06 reports them and performs no repair, cleanup, rollback, `chmod`, or `chown`.

`published-immutable` content cannot change after release publication. `release-mutable` state changes only through release automation. `shared-mutable` and `restricted-mutable` paths remain controlled operational state; backup and log access must stay within the deployment-service authorization boundary.

## Package and version policy

`ubuntu-packages.tsv` supports only Ubuntu 24.04 and 26.04. Every package requires an exact version before a future applying phase. The package reference `latest`, other mutable references, automatic major upgrades, and automatic downgrades are prohibited. Package-source identity and signing-key fingerprint must be verified before use. Installed versions and already-local candidate metadata may be inspected, but `apt update` and network package queries are prohibited. Missing local candidate metadata remains unresolved and never triggers a network query.

The Ubuntu archive classification is policy only and contains no repository endpoint. Docker CE, CLI, containerd, Buildx, and Compose v2 require an external package source whose identity and signing-key fingerprint remain unresolved planning blockers. DP-06 does not add that source or download a key. Legacy `docker-compose`, `docker.io`, Podman, and snap packages are not substitutes.

Buildx is an optional CI capability because production hosts pull immutable images and never build application source. Docker Engine, its client and runtime, and Compose v2 remain required production capabilities.

## Idempotency and transaction policy

Identical inspected state must produce byte-identical plans. Correct paths and packages would remain unchanged. Conflicting paths, unsafe symlinks, incompatible ownership or modes, partial installation, unknown package state, newer unapproved major versions, and unresolved sources fail closed.

Future transaction boundaries are: validate repository contract, supported OS, package sources and exact versions, service identity, `/data`, complete layout, and an immutable execution plan; require separate authorization; then apply packages, apply filesystem state, validate services, and record completion in later phases. DP-06 implements only the first seven boundaries as read-only planning. No mutation may begin before the complete plan validates. A critical blocker stops future application. There is no automatic cleanup or rollback; recovery must be explicitly authorized and independently tested.

DP-07 exercises the later mechanics only through immutable fixture plans inside exact marked disposable roots. Logical manifest paths remain unchanged, packages and identity are simulated, and journals and completion evidence stay inside the disposable root. Public apply, real package/source handling, host identity changes, service activation, automatic recovery, and production installation remain disabled.

DP-08 wraps that same test-only engine in guarded Ubuntu 24.04 and 26.04 containers. It builds and unpacks one inert synthetic Debian package entirely in disposable tmpfs storage, then verifies the existing filesystem, journal, recovery, idempotency, and locking contracts. It neither configures a package source nor installs into a host or container package database. Public apply and production installation remain disabled.
