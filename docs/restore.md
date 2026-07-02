# Restore Guide

Detailed instructions on restoring Zolexora ERP from backups.

---

## 1. Prerequisites

Before executing a restore, verify:
- Your target site name (`SITE_NAME` in `.env`) matches the database backup scope.
- Sudo/root database passwords in `.env` match target MariaDB configurations.
- The containers (`mariadb`, `backend`, `redis-*`) are running.

---

## 2. Restore Procedure

1. Find the path of your backup directory (e.g. `backups/20260703_120000/`).
2. Run the restore helper:
   ```bash
   ./scripts/restore.sh backups/20260703_120000
   ```
3. The script will automatically copy backup files into the container's sites folder, run `bench restore` with correct parameters, and perform database migrations.

---

## 3. Post-Restore Checklist

After restore finishes, run:
- Clear server cache:
  ```bash
  docker compose exec backend bench --site site1.example.com clear-cache
  ```
- Verify site health by logging in to the web browser.
- Check background jobs logs (`docker compose logs worker-short` and `worker-long`) to ensure queues are clear.
