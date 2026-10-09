#!/bin/bash
set -euo pipefail

SCRIPT_NAME="schedule-daily-erp-backup"

log() {
  local level="$1"
  shift
  printf '%s [%s] [%s] %s\n' "$(date -Iseconds)" "$level" "$SCRIPT_NAME" "$*"
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log "INFO" "starting scheduled backup"
./scripts/zolexora-erp/backup-frappe-site.sh
log "INFO" "scheduled backup completed"
