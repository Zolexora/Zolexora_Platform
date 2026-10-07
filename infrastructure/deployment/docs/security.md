# Production security contract

## Status and threat model

DP-09 defines a non-executing, fail-closed Marketplace Compose contract, but no host installation, production security control, or deployment workflow. The repository is not production-ready.

The framework must protect against credential disclosure, unauthorized deployment, supply-chain substitution, SSH impersonation, publicly exposed data services, configuration drift, unsafe filesystem targets, secret leakage in logs, destructive operator error, unverified backups, and compromised external integrations.

## Secrets lifecycle

1. Create production secrets only in an authorized secret-management boundary.
2. Store CI values in a protected GitHub production Environment with required approval and least-privilege access.
3. Deliver only the secrets required for the operation over authenticated, encrypted channels.
4. Store server runtime secrets under `/data/secrets/`, separate from Git checkouts.
5. Give secret directories restrictive ownership and mode, normally `0700`, and secret files normally `0600`; any exception must be justified and no broader than the consuming service requires.
6. Never echo, trace, serialize, archive, or include secret values in command lines or diagnostics.
7. Rotate credentials after suspected disclosure, personnel or trust-boundary changes, and according to the future service policy.
8. Revoke superseded credentials and verify consumers use the replacement.

Development `.env` files are never a production source. Safe examples contain names and placeholders only.

## Deployment authorization and SSH

- Normal production changes originate from a protected GitHub production Environment.
- Workflows require minimal permissions, concurrency protection, immutable release identity, and approval according to repository policy.
- SSH host keys must be pinned and verified. Disabling host-key checking is forbidden.
- Production deployment uses a dedicated restricted key and account with only the permissions required by the deployment contract.
- Password-based production SSH is forbidden.
- SSH is for automated deployment and controlled, logged emergency access—not routine manual editing.

## Network and firewall boundary

- The host firewall defaults to denying unsolicited inbound traffic.
- Only explicitly required SSH and Nginx HTTP/HTTPS access may be exposed.
- Nginx is the only public origin HTTP/HTTPS listener.
- PostgreSQL and Redis must never publish public ports.
- Application services use private Compose networks or local-only bindings.
- Provider firewalls are defense in depth and must not replace the host firewall contract.

## TLS

Cloudflare must connect to the origin using `Full (strict)`. The origin uses a valid Let's Encrypt certificate unless another configured TLS adapter is selected. Expiration renewal and failure reporting must be automated in a later phase. Plain HTTP may exist only for controlled redirection or certificate validation where explicitly required.

## Logs and diagnostics

Logs record timestamps, operation names, release identifiers, outcomes, and non-sensitive error context. They must redact tokens, passwords, private URLs containing credentials, environment values, authorization headers, connection strings, and key material. Shell tracing must not surround secret handling. Logs under `/data/logs/` require rotation and access controls.

## Backup security

Backups must be consistent, encrypted before leaving the trusted host boundary, checksummed, verified, and copied off-server. Encryption and storage credentials are separate from backup artifacts. Restore authorization is distinct from routine backup creation where practical. Backup logs and manifests must not contain secrets or protected application data.

## Emergency access

Emergency access must be explicitly authorized, time-bounded where possible, auditable, and used only when automation cannot safely recover service. Operators must record the reason, commands or changes, affected release, validation, and follow-up needed to return production to declared state. Manual changes must be reconciled through version-controlled automation immediately after the incident.

## Prohibited committed material

Do not commit:

- `.env` runtime files
- Passwords, tokens, API keys, registry credentials, or cloud credentials
- SSH, TLS, backup-encryption, or other private keys
- Certificate bundles containing private material
- Production connection strings or database URLs containing credentials
- Generated secret files or decrypted configuration
- Database dumps, backup archives, or production data
- Runtime state, logs, or host-specific credentials

The `.gitignore` is preventive defense, not permission to create secrets in the repository. Staged content must still be reviewed before every commit.

## Implemented shared safeguards

- Log fields classified as secret are replaced completely with `[REDACTED]`.
- Configuration is parsed as allowlisted literal data and is never sourced or evaluated.
- Managed and destructive paths require explicit allowed roots, canonical containment, and traversal/symlink checks.
- Release identifiers and image references must be immutable and normalized before metadata is accepted.
- Tests use fake values and isolated temporary directories only.

These primitives reduce repeated security mistakes; they do not by themselves make deployment or the repository production-ready.

## Read-only diagnostic safeguards

OS-release data is parsed as literal allowlisted fields and never sourced or evaluated. Diagnostic output excludes hostnames, usernames, network and resolver addresses, process data, raw command output, environment values, and secrets. Listener inspection omits process information and emits counts only; resolver inspection emits no nameserver or resolved address and performs no external DNS query. Filesystem checks use metadata only, never a write probe. The command performs no remediation, and JSON escaping is fixture-tested. Passing diagnostics do not establish production security or readiness.

## Installation-planning safeguards

Filesystem and package manifests are literal allowlisted TSV data and are never sourced. Ownership output uses policy classifications rather than raw user or group identifiers. Package inspection is limited to local dpkg metadata; no package-index refresh or network query occurs. Exact package versions, external source identity, signing-key fingerprint, and deployment service identity remain unresolved. Dry-run JSON always denies apply authorization, host modification, and production readiness.

## Isolated-execution safeguards

Every mutation requires a canonical, owned, mode-`0700`, marked test root directly below `/tmp`; repository, workspace, current, home, `/`, `/tmp`, and `/data` roots are rejected. Logical paths are translated only after validation, symlinks and conflicts block, and cleanup revalidates the exact root. Packages and identities are simulated. Journals, reports, and recovery plans omit host identifiers, temporary paths, credentials, environment values, and raw output. Public apply and automatic recovery remain disabled.

DP-08 additionally requires an exact test-only opt-in, Docker-container evidence, supported literal-parsed Ubuntu data, a read-only repository mount, disabled networking and pulls, dropped capabilities, no-new-privileges, and disposable tmpfs storage. Its inert Debian package is built and unpacked offline without maintainer scripts or package-database installation. Root-local locking prevents concurrent qualification mutation. Generated packages and evidence are destroyed with the container; passing qualification does not authorize production mutation.

## Application-contract safeguards

DP-09 accepts only registry-qualified digest image references and forbids builds, mutable tags, public application ports, host networking, privilege, added capabilities, source mounts, broad host mounts, and secret values in Git. Future services must use capability dropping, no-new-privileges, read-only roots, explicit temporary storage, resource/PID boundaries, internal data networks, and image-owned readiness checks. Secrets are read-only files outside persistent data volumes and must never enter validation output.

The Marketplace service set remains empty until application owners provide authoritative roles, ports, health and migration commands, state ownership, configuration, and secret keys. This deliberate blocker prevents a syntactically valid example from becoming guessed production behavior. Configuration-only validation creates no container, network, volume, secret, or host path. Production readiness remains false.
