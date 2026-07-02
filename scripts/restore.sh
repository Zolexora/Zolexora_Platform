#!/bin/bash
set -euo pipefail

CURRENT_STEP="restore"

log_step() {
  CURRENT_STEP="$1"
  printf '\n✔ %s\n' "$CURRENT_STEP"
}

fail_report() {
  local exit_code=$?
  printf '\nRestore failed\n'
  printf 'Step: %s\n' "$CURRENT_STEP"
  printf 'Exit code: %s\n' "$exit_code"
  printf 'Suggested remediation: verify the backup directory contains database, public files, and private files archives from ./scripts/backup.sh.\n'
  exit "$exit_code"
}

trap fail_report ERR

if [ ! -f .env ]; then
  echo "Please copy .env.example to .env and update values."
  exit 1
fi

set -a
source .env
set +a

if [ -z "$1" ]; then
  echo "Usage: ./scripts/restore.sh backups/<timestamp>"
  exit 1
fi

BACKUP_DIR="$1"
if [ ! -d "$BACKUP_DIR" ]; then
  echo "Backup directory not found: $BACKUP_DIR"
  exit 1
fi

# Default site if not set
SITE="${SITE_NAME:-site1.example.com}"
TIMESTAMP_DIR=$(basename "$BACKUP_DIR")
DB_ROOT="${DB_ROOT_USER:-root}"
DB_ROOT_PASS="${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is required}"

compose_exec() {
  docker compose exec -T "$@"
}

find_backup_file() {
  local pattern="$1"
  local exclude_pattern="${2:-a^}"
  local result

  result=$(find "$BACKUP_DIR" -maxdepth 1 -type f \
    | grep -E "$pattern" \
    | grep -Ev "$exclude_pattern" \
    | sort \
    | tail -n 1 || true)
  printf '%s\n' "$result"
}

log_step "Locating backup archives"
DB_FILE=$(find_backup_file 'database\.sql(\.gz)?$')
PUBLIC_FILES=$(find_backup_file '(^|[-_])public[-_]files.*\.tar(\.gz)?$|(^|[-_])files.*\.tar(\.gz)?$' 'private')
PRIVATE_FILES=$(find_backup_file '(^|[-_])private[-_]files.*\.tar(\.gz)?$')

if [ -z "$DB_FILE" ]; then
  echo "Database backup file not found in $BACKUP_DIR"
  exit 1
fi

if [ -z "$PUBLIC_FILES" ]; then
  echo "Public files backup archive not found in $BACKUP_DIR"
  exit 1
fi

if [ -z "$PRIVATE_FILES" ]; then
  echo "Private files backup archive not found in $BACKUP_DIR"
  exit 1
fi

log_step "Copying backup files"
compose_exec backend mkdir -p "backups/$TIMESTAMP_DIR" "sites/$SITE/private/backups"
compose_exec backend sh -c "cp -f backups/$TIMESTAMP_DIR/* sites/$SITE/private/backups/"

DB_BASENAME=$(basename "$DB_FILE")
PUBLIC_BASENAME=$(basename "$PUBLIC_FILES")
PRIVATE_BASENAME=$(basename "$PRIVATE_FILES")

log_step "Restoring database and files"
compose_exec backend bench --site "$SITE" restore "sites/$SITE/private/backups/$DB_BASENAME" \
  --with-public-files "sites/$SITE/private/backups/$PUBLIC_BASENAME" \
  --with-private-files "sites/$SITE/private/backups/$PRIVATE_BASENAME" \
  --db-root-username "$DB_ROOT" \
  --db-root-password "$DB_ROOT_PASS" \
  --force

log_step "Running migrations"
compose_exec backend bench --site "$SITE" migrate

log_step "Clearing cache"
compose_exec backend bench --site "$SITE" clear-cache

log_step "Rebuilding search index"
if compose_exec backend bench --site "$SITE" build-search-index; then
  echo "Search index rebuilt."
else
  echo "Search index rebuild command is unavailable or failed; continuing after restore."
fi

log_step "Verifying attachment integrity"
compose_exec backend bench --site "$SITE" execute zolexora_core.site_setup.verify_attachment_integrity

echo "Restore completed successfully."
