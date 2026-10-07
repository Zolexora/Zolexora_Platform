# Backup and restore policy

## Status

This is a policy contract, not an implementation. `backup.sh`, `restore.sh`, and `verify-backup.sh` remain unimplemented fail-closed commands as of DP-03 and always exit with status 78 without performing work. Off-server transport belongs behind `adapters/backup/`.

## Backup scope

Future application contracts must identify all state required for recovery, including:

- PostgreSQL data and roles required by the application
- Persistent application volumes and uploaded objects
- Required object-storage data or independently managed recovery references
- Generated deployment and immutable release metadata
- Nginx and TLS state when it cannot be safely regenerated
- Non-secret configuration needed to reconstruct the deployment

Secrets are recovered from their authorized secret-management source and must not be copied into ordinary backup manifests. A future design must explicitly cover any secret that cannot be regenerated.

## Consistency and integrity

Backups must use database-aware snapshots, dumps, application quiescence, or another documented method that produces a recoverable point-in-time set. Copying live database files without a supported consistency mechanism is forbidden.

Each artifact requires a manifest, cryptographic checksum, creation time, application/release identity, schema or format information, and verification result. Verification must detect truncation, corruption, missing components, and inability to decrypt.

## Encryption and off-server copies

Backup artifacts must be encrypted before leaving the trusted server boundary. Encryption keys must not be stored with the encrypted artifacts. At least one verified copy must be placed at a configured off-server destination through a replaceable backup adapter. The core cannot directly depend on a specific object-storage provider.

## Retention and evidence

Retention periods, generations, and legal requirements will be explicit configuration in a later phase; DP-03 does not invent values. Deletion must operate only on validated backup artifact paths and must preserve required verification and audit evidence.

For every backup, retain non-secret evidence of artifact identity, checksum, encryption status, off-server copy status, verification status, and any failure. Logs must not expose protected data or credentials.

## Restore and testing

A restore accepts only an explicitly selected, authorized backup that has passed checksum and decryptability checks. It must validate destination paths and require deliberate authorization before replacing data.

Restore procedures must be rehearsed on an isolated target at a defined future cadence. A backup is not considered operationally trustworthy until restoration and application-level checks have succeeded. Test results become audit evidence.

## Separation of authorization

Routine backup creation should not grant permission to restore over production or delete retained copies. Restore and destructive retention operations require separate, explicit authorization where the selected platform permits it.
