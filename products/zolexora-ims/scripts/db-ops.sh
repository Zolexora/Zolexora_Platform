#!/usr/bin/env bash
# Zolexora IMS — SQLite database operations on the running Docker stack.
#   db-ops.sh status                 tables and row counts
#   db-ops.sh query "<sql>"          run one SQL statement, print rows as JSON
#   db-ops.sh backup                 SQL dump to $IMS_BACKUPS_DIR (default ~/zolexora-ims-backups)
#   db-ops.sh restore <file.sql>     replace the database with a dump (the old file is kept beside it)
#   db-ops.sh restore-points         list the continuous (Litestream) backups in the bucket
#   db-ops.sh restore-to <UTC time>  replace the database with its state at that time, e.g. 2026-11-11T09:30:00Z
# The database is the file at DATABASE_PATH (/data/ims.db) inside the API container; tables are
# created by the API on start from services/user-api/schema.sql. There are no migrations. Litestream
# also copies every change to the S3-compatible bucket (IMS_BACKUP_S3_*); see docker-entrypoint.sh.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "${ROOT_DIR}/../.." && pwd)"
BACKUPS_DIR="${IMS_BACKUPS_DIR:-${HOME}/zolexora-ims-backups}"  # business data: kept outside the repo
SERVICE=ims-user-backend

dc() { bash "${REPO_ROOT}/scripts/setup/with-infisical.sh" "${ROOT_DIR}" docker compose -f "${ROOT_DIR}/compose.yaml" "$@"; }
py() { dc exec -T "${SERVICE}" python -c "$1" "${@:2}"; }

case "${1:-help}" in
  status)
    py 'import os, sqlite3
c = sqlite3.connect(os.environ["DATABASE_PATH"])
print(os.environ["DATABASE_PATH"], os.path.getsize(os.environ["DATABASE_PATH"]), "bytes")
for (t,) in c.execute("SELECT name FROM sqlite_master WHERE type = ? ORDER BY name", ("table",)).fetchall():
    print(t.ljust(28), c.execute("SELECT COUNT(*) FROM [" + t + "]").fetchone()[0])'
    ;;
  query)
    [[ -n "${2:-}" ]] || { echo "Usage: db-ops.sh query \"SELECT org_id, item_code, total_stock FROM products LIMIT 5\"" >&2; exit 1; }
    py 'import json, os, sqlite3, sys
c = sqlite3.connect(os.environ["DATABASE_PATH"]); c.row_factory = sqlite3.Row
rows = [dict(r) for r in c.execute(sys.argv[1])]; c.commit()
print(json.dumps(rows, indent=2, default=str))' "$2"
    ;;
  backup)
    mkdir -p "${BACKUPS_DIR}"
    file="${BACKUPS_DIR}/ims_$(date +%Y%m%d_%H%M%S).sql"
    if py 'import os, sqlite3, sys
for line in sqlite3.connect(os.environ["DATABASE_PATH"]).iterdump():
    sys.stdout.write(line + "\n")' > "${file}" && [[ -s "${file}" ]]; then
      echo "✓ Backup written to ${file}"
    else
      rm -f "${file}"; echo "❌ Backup failed." >&2; exit 1
    fi
    ;;
  restore)
    file="${2:-}"
    [[ -f "${file}" ]] || { echo "Usage: db-ops.sh restore <backup.sql>" >&2; exit 1; }
    read -r -p "Replace the IMS database with ${file}? The API stops briefly. [y/N] " ok
    [[ "${ok}" == [yY] ]] || exit 1
    dc stop "${SERVICE}"
    dc run --rm --no-deps -T "${SERVICE}" python -c 'import os, shutil, sqlite3, sys, time
p = os.environ["DATABASE_PATH"]; tmp = p + ".restoring"
if os.path.exists(tmp): os.remove(tmp)
c = sqlite3.connect(tmp); c.executescript(sys.stdin.read()); c.commit(); c.close()
if os.path.exists(p):
    os.rename(p, p + time.strftime(".before-restore-%Y%m%d_%H%M%S"))
for ext in ("-wal", "-shm"):
    if os.path.exists(p + ext): os.remove(p + ext)
shutil.rmtree(os.path.join(os.path.dirname(p), "." + os.path.basename(p) + "-litestream"), ignore_errors=True)
os.rename(tmp, p); print("restored", p)' < "${file}"
    dc start "${SERVICE}"
    ;;
  restore-points)
    dc exec -T "${SERVICE}" sh -c 'litestream ltx -config /app/litestream.yml "$DATABASE_PATH"'
    ;;
  restore-to)
    when="${2:-}"
    [[ -n "${when}" ]] || { echo "Usage: db-ops.sh restore-to 2026-11-11T09:30:00Z   (see: db-ops.sh restore-points)" >&2; exit 1; }
    read -r -p "Replace the IMS database with its state at ${when}? The API stops briefly. [y/N] " ok
    [[ "${ok}" == [yY] ]] || exit 1
    dc stop "${SERVICE}"
    dc run --rm --no-deps -T "${SERVICE}" sh -c 'set -e
p="$DATABASE_PATH"; tmp="$p.restoring"; rm -f "$tmp"
litestream restore -config /app/litestream.yml -timestamp "$1" -o "$tmp" "$p"
[ ! -f "$p" ] || mv "$p" "$p.before-restore-$(date +%Y%m%d_%H%M%S)"
rm -rf "$p-wal" "$p-shm" "$(dirname "$p")/.$(basename "$p")-litestream"
mv "$tmp" "$p"; echo "restored $p to $1"' _ "${when}"
    dc start "${SERVICE}"
    ;;
  *)
    sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
    [[ "${1:-help}" == help || "${1:-}" == -h ]] || exit 1
    ;;
esac
