#!/bin/bash
set -euo pipefail

SCRIPT_NAME="backup"
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

SITE="${SITE_NAME:-site1.example.com}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
BACKUP_ROOT="${BACKUP_ROOT:-storage/backups}"
BACKUP_DIR="$BACKUP_ROOT/$(date +%Y%m%d_%H%M%S)"
CONTAINER_BACKUP_DIR="/home/frappe/frappe-bench/backups/$(basename "$BACKUP_DIR")"

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
    log "ERROR" "required backup artifact not found: $pattern"
    return 1
  fi

  printf '%s\n' "$result"
}

verify_backup() {
  step "Verifying backup artifacts"
  local db_file public_file private_file

  db_file=$(find_required_file 'database\.sql(\.gz)?$')
  public_file=$(find_required_file '(^|[-_])public[-_]files.*\.tar(\.gz)?$|(^|[-_])files.*\.tar(\.gz)?$' 'private')
  private_file=$(find_required_file '(^|[-_])private[-_]files.*\.tar(\.gz)?$')

  test -s "$db_file"
  test -s "$public_file"
  test -s "$private_file"

  if [[ "$db_file" == *.gz ]]; then
    gzip -t "$db_file"
  fi

  tar -tf "$public_file" >/dev/null
  tar -tf "$private_file" >/dev/null

  step "Writing checksum manifest"
  (
    cd "$BACKUP_DIR"
    sha256sum "$(basename "$db_file")" "$(basename "$public_file")" "$(basename "$private_file")" > SHA256SUMS
  )
  if find "$BACKUP_DIR" -maxdepth 1 -type f -name '*site_config_backup.json' | grep -q .; then
    (
      cd "$BACKUP_DIR"
      sha256sum *site_config_backup.json >> SHA256SUMS
    )
  fi
  (cd "$BACKUP_DIR" && sha256sum -c SHA256SUMS)
}

mkdir -p "$BACKUP_DIR"
chmod 0777 "$BACKUP_DIR"

step "Creating full Frappe backup for site $SITE"
compose_exec backend bench --site "$SITE" backup --with-files

step "Copying latest backup artifacts to host folder $BACKUP_DIR"
compose_exec backend mkdir -p "$CONTAINER_BACKUP_DIR"
compose_exec backend sh -c "find sites/$SITE/private/backups -maxdepth 1 -type f -mmin -30 -exec cp -f {} backups/$(basename "$BACKUP_DIR")/ \\;"

verify_backup

step "Applying retention: deleting backup directories older than $BACKUP_RETENTION_DAYS days"
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$BACKUP_RETENTION_DAYS" -exec rm -rf {} +

log "INFO" "backup completed successfully: $BACKUP_DIR"
