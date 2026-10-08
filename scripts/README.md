# Platform Operational Scripts

This directory houses global platform-level automation, backup, site initialization, health checks, and disaster recovery scripts for the Zolexora Platform monorepo.

> **Note**: Product-specific scripts are maintained within their respective product workspaces at `products/<Product>/scripts/`.

## Script Inventory

| Script | Purpose |
|--------|---------|
| [`backup.sh`](./backup.sh) | Creates full, timestamped MariaDB backups and assets for ERP sites. |
| [`daily-backup.sh`](./daily-backup.sh) | Automated scheduler entry point that invokes `backup.sh`. |
| [`restore.sh`](./restore.sh) | Restores MariaDB databases and site assets from timestamped backups. |
| [`healthcheck.sh`](./healthcheck.sh) | Performs service health verification against running platform backends. |
| [`status.sh`](./status.sh) | Gathers and displays system service status and container health. |
| [`init-site.sh`](./init-site.sh) | Bootstraps and initializes new Frappe / ERP platform sites. |
| [`configure-common-site.sh`](./configure-common-site.sh) | Configures common database and cache connectivity for sites. |
| [`disaster-recovery-test.sh`](./disaster-recovery-test.sh) | Automated end-to-end disaster recovery testing harness. |
| [`payments-clean-site-test.sh`](./payments-clean-site-test.sh) | Validates clean-site payments integration behavior. |
| [`upgrade-validation.sh`](./upgrade-validation.sh) | Runs pre- and post-upgrade validation assertions. |
| [`yarn-wrapper.sh`](./yarn-wrapper.sh) | Corepack-compatible wrapper script for yarn inside Docker containers. |
