#!/bin/bash
set -euo pipefail

SCRIPT_NAME="test-erp-disaster-recovery"
CURRENT_STEP="startup"
REPORT="docs/disaster-recovery-report.md"

log() {
  local level="$1"
  shift
  printf '%s [%s] [%s] %s\n' "$(date -Iseconds)" "$level" "$SCRIPT_NAME" "$*"
}

step() {
  CURRENT_STEP="$1"
  log "INFO" "$CURRENT_STEP"
}

fail_report() {
  local exit_code=$?
  log "ERROR" "failed during step: $CURRENT_STEP"
  {
    printf '# Disaster Recovery Report\n\n'
    printf 'Date: %s\n' "$(date -Iseconds)"
    printf 'Result: FAILED\n\n'
    printf 'Failed step: `%s`\n\n' "$CURRENT_STEP"
    printf 'Exit code: `%s`\n\n' "$exit_code"
    printf 'Production certification: BLOCKED\n'
  } > "$REPORT"
  exit "$exit_code"
}

trap fail_report ERR

if [ "${ZOLEXORA_ALLOW_DESTRUCTIVE_DR:-0}" != "1" ]; then
  log "ERROR" "refusing destructive DR test without ZOLEXORA_ALLOW_DESTRUCTIVE_DR=1"
  log "ERROR" "this script deletes deterministic validation data before restoring it from backup"
  exit 1
fi

if [ ! -f config/envs/zolexora-erp/erp.env ]; then
  log "ERROR" "missing .env"
  exit 1
fi

set -a
source config/envs/zolexora-erp/erp.env
set +a

SITE="${SITE_NAME:-site1.example.com}"
TMP_LOG="/tmp/zolexora-dr-$$.log"

compose_exec() {
  docker compose -f compose.yaml exec -T "$@"
}

step "Starting from initialized site"
./products/zolexora-erp/scripts/bootstrap-frappe-site.sh | tee "$TMP_LOG"

step "Creating DR validation data"
CREATE_JSON=$(compose_exec backend bench --site "$SITE" execute zolexora_core.site_setup.create_dr_validation_data)

step "Creating verified backup"
./products/zolexora-erp/scripts/backup-frappe-site.sh | tee -a "$TMP_LOG"
BACKUP_DIR=$(find storage/backups -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1)
test -n "$BACKUP_DIR"
test -f "$BACKUP_DIR/SHA256SUMS"

step "Recording checksum evidence"
CHECKSUMS=$(cat "$BACKUP_DIR/SHA256SUMS")

step "Destroying deterministic DR validation data"
DESTROY_JSON=$(compose_exec backend bench --site "$SITE" execute zolexora_core.site_setup.destroy_dr_validation_data)

step "Restoring from verified backup"
./products/zolexora-erp/scripts/restore-frappe-site.sh "$BACKUP_DIR" | tee -a "$TMP_LOG"

step "Validating restored data and attachments"
VALIDATION_JSON=$(compose_exec backend bench --site "$SITE" execute zolexora_core.site_setup.validate_dr_validation_data)

step "Verifying health after restore"
./products/zolexora-erp/scripts/check-frappe-stack-health.sh | tee -a "$TMP_LOG"

{
  printf '# Disaster Recovery Report\n\n'
  printf 'Date: %s\n' "$(date -Iseconds)"
  printf 'Result: PASSED\n\n'
  printf '## Commands Executed\n\n'
  printf '```bash\n'
  printf './products/zolexora-erp/scripts/bootstrap-frappe-site.sh\n'
  printf 'bench --site %s execute zolexora_core.site_setup.create_dr_validation_data\n' "$SITE"
  printf './products/zolexora-erp/scripts/backup-frappe-site.sh\n'
  printf 'bench --site %s execute zolexora_core.site_setup.destroy_dr_validation_data\n' "$SITE"
  printf './products/zolexora-erp/scripts/restore-frappe-site.sh %s\n' "$BACKUP_DIR"
  printf 'bench --site %s execute zolexora_core.site_setup.validate_dr_validation_data\n' "$SITE"
  printf './products/zolexora-erp/scripts/check-frappe-stack-health.sh\n'
  printf '```\n\n'
  printf '## Backup Directory\n\n`%s`\n\n' "$BACKUP_DIR"
  printf '## Checksum Evidence\n\n```text\n%s\n```\n\n' "$CHECKSUMS"
  printf '## Created Data\n\n```json\n%s\n```\n\n' "$CREATE_JSON"
  printf '## Destroyed Data\n\n```json\n%s\n```\n\n' "$DESTROY_JSON"
  printf '## Validation JSON\n\n```json\n%s\n```\n\n' "$VALIDATION_JSON"
  printf '## Decision\n\nDisaster recovery certification passed for deterministic validation data and attachment restoration.\n'
} > "$REPORT"

log "INFO" "disaster recovery test passed; report written to $REPORT"
