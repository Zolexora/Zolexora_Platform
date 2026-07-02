# Backup Guide

Detailed instructions on managing, scheduling, and verifying backups in Zolexora ERP.

---

## 1. Backup Strategy

Zolexora ERP uses Frappe's built-in `bench backup` command rather than raw database dumps. This ensures:
- Full database serialization (MySQL structure and contents).
- Public files (uploads, attachments) are archived in `.tar`.
- Private files (sensitive documentation, receipts) are archived in `.tar`.
- Automated checksum generation.

---

## 2. Triggering Backups

To execute a complete backup manually:
```bash
./scripts/backup.sh
```
This runs the backup inside the container, copies the files to the host mount folder (`backups/<timestamp>`), and prunes older backups.

---

## 3. Automation (Cron Schedule)

To schedule daily backups, configure a cron job on your host system:
```bash
0 2 * * * cd /path/to/ZolexoraERP && ./scripts/daily-backup.sh >> /var/log/zolexora-backup.log 2>&1
```
This runs the backup script daily at 2:00 AM.
