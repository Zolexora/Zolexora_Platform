#!/bin/bash
set -euo pipefail

SCRIPT_NAME="payments-clean-site-test"
CURRENT_STEP="startup"
PROJECT_NAME="${PROJECT_NAME:-zolexora_payments_test}"
SITE="${PAYMENTS_TEST_SITE:-payments-test.local}"
ADMIN_PASS="${ADMIN_PASSWORD:-ChangeMe123!}"
DB_ROOT="${DB_ROOT_USER:-root}"
DB_ROOT_PASS="${MYSQL_ROOT_PASSWORD:-ChangeMe123!}"
OVERRIDE_FILE="/tmp/${PROJECT_NAME}-compose.override.yml"
LOG_FILE="/tmp/${PROJECT_NAME}.log"
REPORT_FILE="docs/phase-3.8B-payments-clean-site-test-output.txt"

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
  log "ERROR" "exit code: $exit_code"
  {
    printf 'Result: FAIL\n'
    printf 'Step: %s\n' "$CURRENT_STEP"
    printf 'Exit code: %s\n' "$exit_code"
    printf 'Log file: %s\n' "$LOG_FILE"
  } > "$REPORT_FILE"
  exit "$exit_code"
}

trap fail_report ERR

if [ "${ZOLEXORA_ALLOW_CLEAN_SITE_TEST:-0}" != "1" ]; then
  log "ERROR" "refusing clean-site test without ZOLEXORA_ALLOW_CLEAN_SITE_TEST=1"
  exit 1
fi

compose_test() {
  SITE_NAME="$SITE" \
  FRAPPE_PORT=18000 \
  HTTP_PORT=18080 \
  HTTPS_PORT=18443 \
  MYSQL_ROOT_PASSWORD="$DB_ROOT_PASS" \
  MYSQL_DATABASE="${MYSQL_DATABASE:-frappe}" \
  MYSQL_USER="${MYSQL_USER:-frappe}" \
  MYSQL_PASSWORD="${MYSQL_PASSWORD:-frappe}" \
  docker compose -p "$PROJECT_NAME" -f compose.yaml -f "$OVERRIDE_FILE" "$@"
}

compose_exec() {
  compose_test exec -T "$@"
}

step "Writing isolated Compose override"
cat > "$OVERRIDE_FILE" <<YAML
services:
  mariadb:
    container_name: ${PROJECT_NAME}-mariadb
  redis-cache:
    container_name: ${PROJECT_NAME}-redis-cache
  redis-queue:
    container_name: ${PROJECT_NAME}-redis-queue
  redis-socketio:
    container_name: ${PROJECT_NAME}-redis-socketio
  backend:
    container_name: ${PROJECT_NAME}-backend
    ports:
      - "18000:8000"
  scheduler:
    container_name: ${PROJECT_NAME}-scheduler
  worker-short:
    container_name: ${PROJECT_NAME}-worker-short
  worker-long:
    container_name: ${PROJECT_NAME}-worker-long
  socketio:
    container_name: ${PROJECT_NAME}-socketio
  nginx:
    container_name: ${PROJECT_NAME}-nginx
    ports:
      - "18080:80"
      - "18443:443"
YAML

step "Removing any previous isolated test project"
compose_test down -v --remove-orphans >> "$LOG_FILE" 2>&1 || true

step "Starting isolated services"
compose_test up -d mariadb redis-cache redis-queue redis-socketio backend >> "$LOG_FILE" 2>&1

step "Configuring backend"
compose_exec backend configure-common-site >> "$LOG_FILE" 2>&1

step "Creating clean test site with ERPNext"
compose_exec backend bench new-site "$SITE" \
  --db-host mariadb \
  --db-root-username "$DB_ROOT" \
  --db-root-password "$DB_ROOT_PASS" \
  --admin-password "$ADMIN_PASS" \
  --install-app erpnext \
  --set-default >> "$LOG_FILE" 2>&1

step "Running ERPNext migration"
compose_exec backend bench --site "$SITE" migrate >> "$LOG_FILE" 2>&1

step "Checking Payment Gateway before Payments install"
compose_exec backend bench --site "$SITE" execute frappe.db.exists --args '["DocType", "Payment Gateway"]' | tee -a "$LOG_FILE"

step "Registering Payments in bench apps.txt"
compose_exec backend sh -c "grep -qx payments sites/apps.txt || printf '%s\n' payments >> sites/apps.txt"

step "Attempting Payments install"
if compose_exec backend bench --site "$SITE" install-app payments 2>&1 | tee -a "$LOG_FILE"; then
  RESULT="PASS"
else
  RESULT="FAIL"
fi

step "Recording clean-site result"
{
  printf 'Result: %s\n' "$RESULT"
  printf 'Project: %s\n' "$PROJECT_NAME"
  printf 'Site: %s\n' "$SITE"
  printf 'Log file: %s\n' "$LOG_FILE"
  printf 'Installed apps:\n'
  compose_exec backend bench --site "$SITE" list-apps || true
} > "$REPORT_FILE"

step "Stopping isolated services"
compose_test down -v --remove-orphans >> "$LOG_FILE" 2>&1

if [ "$RESULT" != "PASS" ]; then
  log "ERROR" "Payments clean-site install failed; see $REPORT_FILE and $LOG_FILE"
  exit 1
fi

log "INFO" "Payments clean-site install passed"
