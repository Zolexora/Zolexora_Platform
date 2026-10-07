#!/bin/bash
set -euo pipefail

SCRIPT_NAME="upgrade-validation"
CURRENT_STEP="startup"
REPORT="docs/upgrade-validation-report.md"

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
    printf '# Upgrade Validation Report\n\n'
    printf 'Date: %s\n' "$(date -Iseconds)"
    printf 'Result: FAILED\n\n'
    printf 'Failed step: `%s`\n\n' "$CURRENT_STEP"
    printf 'Exit code: `%s`\n\n' "$exit_code"
    printf 'Production certification: BLOCKED\n'
  } > "$REPORT"
  exit "$exit_code"
}

trap fail_report ERR

if [ ! -f .env ]; then
  log "ERROR" "missing .env"
  exit 1
fi

set -a
source .env
set +a

SITE="${SITE_NAME:-site1.example.com}"
RUN_BUILD="${RUN_UPGRADE_BUILD:-0}"

compose_exec() {
  docker compose -f compose.yaml exec -T "$@"
}

step "Recording current app versions"
VERSIONS_BEFORE=$(compose_exec backend bench --site "$SITE" list-apps)

if [ "$RUN_BUILD" = "1" ]; then
  step "Building target v16 image"
  docker compose -f compose.yaml build --pull
  step "Starting target v16 services"
  docker compose -f compose.yaml up -d backend scheduler worker-short worker-long socketio nginx
else
  log "WARN" "RUN_UPGRADE_BUILD=1 was not set; image pull/build upgrade simulation is NOT CERTIFIED"
fi

step "Running migrations"
compose_exec backend bench --site "$SITE" migrate

step "Clearing cache"
compose_exec backend bench --site "$SITE" clear-cache

step "Recreating Zolexora Workspaces after upgrade migration"
WORKSPACE_JSON=$(compose_exec backend bench --site "$SITE" execute zolexora_core.site_setup.create_custom_workspaces)

step "Validating hooks import"
IMPORT_JSON=$(compose_exec backend bench --site "$SITE" execute zolexora_core.site_setup.validate_custom_app_imports)

step "Validating site smoke checks"
SMOKE_JSON=$(compose_exec backend bench --site "$SITE" execute zolexora_core.site_setup.smoke_validate)

step "Validating background workers"
WORKER_JSON=$(compose_exec backend bench --site "$SITE" execute zolexora_core.site_setup.background_job_probe)

step "Validating upgrade integrity"
UPGRADE_INTEGRITY_JSON=$(compose_exec backend bench --site "$SITE" execute zolexora_core.site_setup.validate_upgrade_integrity)

step "Recording final app versions"
VERSIONS_AFTER=$(compose_exec backend bench --site "$SITE" list-apps)

{
  printf '# Upgrade Validation Report\n\n'
  printf 'Date: %s\n' "$(date -Iseconds)"
  if [ "$RUN_BUILD" = "1" ]; then
    printf 'Result: PASSED for local v16 build and migration validation\n\n'
  else
    printf 'Result: PARTIAL - latest image upgrade NOT CERTIFIED\n\n'
  fi
  printf '## Versions Before\n\n```text\n%s\n```\n\n' "$VERSIONS_BEFORE"
  printf '## Versions After\n\n```text\n%s\n```\n\n' "$VERSIONS_AFTER"
  printf '## Smoke Validation\n\n```json\n%s\n```\n\n' "$SMOKE_JSON"
  printf '## Workspace Recreation\n\n```json\n%s\n```\n\n' "$WORKSPACE_JSON"
  printf '## Import Validation\n\n```json\n%s\n```\n\n' "$IMPORT_JSON"
  printf '## Worker Validation\n\n```json\n%s\n```\n\n' "$WORKER_JSON"
  printf '## Upgrade Integrity\n\n```json\n%s\n```\n\n' "$UPGRADE_INTEGRITY_JSON"
  printf '## Upgrade Evidence\n\n'
  if [ "$RUN_BUILD" = "1" ]; then
    printf 'Image build/pull, migration, post-migration Workspace recreation, hook imports, smoke validation, worker probe, and failed-patch/schema-conflict checks completed.\n'
  else
    printf 'Migration, post-migration Workspace recreation, hook imports, smoke validation, worker probe, and failed-patch/schema-conflict checks completed. A real latest supported v16 image upgrade remains NOT CERTIFIED until RUN_UPGRADE_BUILD=1 is executed in CI or staging.\n'
  fi
} > "$REPORT"

log "INFO" "upgrade validation report written to $REPORT"
