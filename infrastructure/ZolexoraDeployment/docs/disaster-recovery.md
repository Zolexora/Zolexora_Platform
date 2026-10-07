# Disaster recovery contract

## Status and objectives

This document defines policy-level requirements only. Recovery Point Objective and Recovery Time Objective values must be explicitly selected, justified, configured, and tested in a later phase. DP-03 makes no guaranteed RPO or RTO claim and adds no executable recovery procedure.

## New-server recovery flow

1. Authorize the incident and preserve evidence from the affected server.
2. Create a new supported Ubuntu server through the provider or an optional infrastructure adapter.
3. Verify its identity, networking, storage, SSH host key, and administrative access.
4. Run the future automated, idempotent server setup.
5. Select a backup that satisfies the incident scope and configured recovery objective.
6. Verify its manifest, checksum, encryption metadata, off-server provenance, and restore authorization.
7. Restore data on an isolated target and rehearse critical application checks when incident timing permits.
8. Restore authorized production data and required persistent storage.
9. Deploy the recorded immutable application release through GitHub Actions.
10. Pass database, internal, origin, and public health checks.
11. Update Cloudflare DNS through the authorized adapter when cutover is required.
12. Observe the configured rollback window while retaining the old server and data safely.

## Restore rehearsal

Rehearsals must prove that backup artifacts decrypt, restore in the documented order, match the expected application/schema version, and support critical application operations. A rehearsal must not contact production or overwrite production data unless separately authorized as a live recovery exercise.

## Rollback and retirement evidence

The old server remains available, isolated as appropriate, throughout a configured rollback window. Before retiring it, record:

- Selected backup and successful verification evidence
- Restored immutable release identity
- Migration and restore outcomes
- Internal and public health results
- Verification of critical application operations
- Cloudflare DNS/proxy state and origin TLS validation
- Monitoring observation through the acceptance window
- Named authorization to retire the old server

The old server must not be destroyed merely because DNS has changed. Destruction requires explicit authorization after acceptance and confirmation that required evidence and backups are preserved.
