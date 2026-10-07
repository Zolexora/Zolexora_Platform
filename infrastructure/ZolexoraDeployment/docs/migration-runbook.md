# Production server migration contract

This is the required high-level order for a future migration. It remains a policy contract in DP-03, not an executable operator runbook, and none of the referenced automation exists yet.

1. Create a new supported Ubuntu server.
2. Run the future automated server setup.
3. Configure protected GitHub production secrets.
4. Transfer and verify backup data.
5. Perform a restore rehearsal.
6. Restore production data.
7. Deploy through GitHub Actions.
8. Pass internal and public health checks.
9. Update Cloudflare DNS.
10. Keep the old server during the rollback window.
11. Verify critical application operations.
12. Retire the old server only after acceptance.

Before execution, a later runbook must supply authorized operators, immutable release identity, application-specific backup scope, migration compatibility, health endpoints, configured recovery objectives, rollback duration, DNS strategy, and acceptance criteria. It must also define the stop and rollback decision at each irreversible step.

No step authorizes manual production configuration drift, disabled SSH host verification, unverified backup restoration, public database exposure, or destruction of the old server without explicit approval.
