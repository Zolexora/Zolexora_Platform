#!/bin/bash
set -euo pipefail

SCRIPT_NAME="restore"
CURRENT_STEP="startup"

log() {
  local level="$1"
  shift
  printf '%s [%s] [%s] %s\n' "$(date -Iseconds)" "$level" "$SCRIPT_NAME" "$*"
}

fail_report() {
  local exit_code=$?
  log "ERROR" "failed during step: $CURRENT_STEP"
  log "ERROR" "exit code: $exit_code"
  log "ERROR" "verify the backup directory contains database, public files, private files, and optional SHA256SUMS from scripts/backup.sh"
  exit "$exit_code"
}

trap fail_report ERR

step() {
  CURRENT_STEP="$1"
  log "INFO" "$CURRENT_STEP"
}

if [ ! -f .env ]; then
  log "ERROR" "missing .env; copy .env.example to .env and update values"
  exit 1
fi

set -a
source .env
set +a

if [ "${1:-}" = "" ]; then
  log "ERROR" "usage: ./scripts/restore.sh backups/<timestamp>"
  exit 1
fi

BACKUP_DIR="$1"
if [ ! -d "$BACKUP_DIR" ]; then
  log "ERROR" "backup directory not found: $BACKUP_DIR"
  exit 1
fi

SITE="${SITE_NAME:-site1.example.com}"
TIMESTAMP_DIR=$(basename "$BACKUP_DIR")
DB_ROOT="${DB_ROOT_USER:-root}"
DB_ROOT_PASS="${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is required}"

compose_exec() {
  docker compose -f compose.yaml exec -T "$@"
}

find_required_file() {
  local pattern="$1"
  local exclude_pattern="${2:-a^}"
  local result

  result=$(find "$BACKUP_DIR" -maxdepth 1 -type f \
    | grep -E "$pattern" \
    | grep -Ev "$exclude_pattern" \
    | sort \
    | tail -n 1 || true)

  if [ -z "$result" ]; then
    log "ERROR" "required restore artifact not found: $pattern"
    return 1
  fi

  printf '%s\n' "$result"
}

step "Locating required backup archives"
DB_FILE=$(find_required_file 'database\.sql(\.gz)?$')
PUBLIC_FILES=$(find_required_file '(^|[-_])public[-_]files.*\.tar(\.gz)?$|(^|[-_])files.*\.tar(\.gz)?$' 'private')
PRIVATE_FILES=$(find_required_file '(^|[-_])private[-_]files.*\.tar(\.gz)?$')

step "Validating archive readability"
test -s "$DB_FILE"
test -s "$PUBLIC_FILES"
test -s "$PRIVATE_FILES"
if [[ "$DB_FILE" == *.gz ]]; then
  gzip -t "$DB_FILE"
fi
tar -tf "$PUBLIC_FILES" >/dev/null
tar -tf "$PRIVATE_FILES" >/dev/null

if [ -f "$BACKUP_DIR/SHA256SUMS" ]; then
  step "Verifying checksum manifest"
  (cd "$BACKUP_DIR" && sha256sum -c SHA256SUMS)
else
  log "WARN" "checksum manifest missing; restore will continue after archive validation"
fi

step "Copying backup files into container"
compose_exec backend mkdir -p "backups/$TIMESTAMP_DIR" "sites/$SITE/private/backups"
compose_exec backend sh -c "cp -f backups/$TIMESTAMP_DIR/* sites/$SITE/private/backups/"

DB_BASENAME=$(basename "$DB_FILE")
PUBLIC_BASENAME=$(basename "$PUBLIC_FILES")
PRIVATE_BASENAME=$(basename "$PRIVATE_FILES")

step "Restoring database and file archives"
compose_exec backend bench --site "$SITE" restore "sites/$SITE/private/backups/$DB_BASENAME" \
  --with-public-files "sites/$SITE/private/backups/$PUBLIC_BASENAME" \
  --with-private-files "sites/$SITE/private/backups/$PRIVATE_BASENAME" \
  --db-root-username "$DB_ROOT" \
  --db-root-password "$DB_ROOT_PASS" \
  --force

step "Running migrations"
compose_exec backend bench --site "$SITE" migrate

step "Clearing cache"
compose_exec backend bench --site "$SITE" clear-cache

step "Rebuilding search index if supported"
if compose_exec backend bench --site "$SITE" build-search-index; then
  log "INFO" "search index rebuilt"
else
  log "WARN" "search index rebuild command unavailable or failed; continuing after restore"
fi

step "Verifying attachment integrity"
compose_exec backend bench --site "$SITE" execute zolexora_core.site_setup.verify_attachment_integrity

step "Running smoke validation"
compose_exec backend bench --site "$SITE" execute zolexora_core.site_setup.smoke_validate

log "INFO" "restore completed successfully from $BACKUP_DIR"
