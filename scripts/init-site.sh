#!/bin/bash
set -euo pipefail

CURRENT_STEP="bootstrap"
SCRIPT_NAME="init-site"

log() {
  local level="$1"
  shift
  printf '%s [%s] [%s] %s\n' "$(date -Iseconds)" "$level" "$SCRIPT_NAME" "$*"
}

log_step() {
  CURRENT_STEP="$1"
  log "INFO" "$CURRENT_STEP"
}

fail_report() {
  local exit_code=$?
  log "ERROR" "Bootstrap failed"
  log "ERROR" "Step: $CURRENT_STEP"
  log "ERROR" "Exit code: $exit_code"
  log "ERROR" "Suggested remediation: review the exception above, fix the failing bootstrap phase, then rerun ./scripts/init-site.sh"
  exit "$exit_code"
}

trap fail_report ERR

if [ ! -f .env ]; then
  echo "Please copy .env.example to .env and update the values."
  exit 1
fi

set -a
source .env
set +a

SITE="${SITE_NAME:-site1.example.com}"
ADMIN_PASS="${ADMIN_PASSWORD:?ADMIN_PASSWORD is required}"
DB_ROOT="${DB_ROOT_USER:-root}"
DB_ROOT_PASS="${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is required}"
INSTALL_PAYMENTS="${INSTALL_PAYMENTS:-0}"

compose_exec() {
  docker compose -f compose.yaml exec -T "$@"
}

site_database_grant_sql() {
  compose_exec backend python3 - "$SITE" <<'PY'
import json
import sys

site = sys.argv[1]
with open(f"sites/{site}/site_config.json", encoding="utf-8") as handle:
    config = json.load(handle)

db_name = config["db_name"]
db_user = config.get("db_user") or db_name
db_password = config["db_password"]

def sql_literal(value):
    return "'" + str(value).replace("\\", "\\\\").replace("'", "''") + "'"

def sql_identifier(value):
    return "`" + str(value).replace("`", "``") + "`"

print(f"CREATE USER IF NOT EXISTS {sql_literal(db_user)}@'%' IDENTIFIED BY {sql_literal(db_password)};")
print(f"ALTER USER {sql_literal(db_user)}@'%' IDENTIFIED BY {sql_literal(db_password)};")
print(f"GRANT ALL PRIVILEGES ON {sql_identifier(db_name)}.* TO {sql_literal(db_user)}@'%';")
print("FLUSH PRIVILEGES;")
PY
}

ensure_site_database_network_access() {
  log_step "Ensuring site database network access"
  site_database_grant_sql | compose_exec mariadb mariadb -u"$DB_ROOT" -p"$DB_ROOT_PASS"
  log "INFO" "Ensured site database user can connect from Compose service containers"
}

app_available() {
  local app="$1"
  compose_exec backend test -d "apps/$app"
}

ensure_app_in_apps_txt() {
  local app="$1"
  local required="${2:-required}"

  if ! app_available "$app"; then
    if [ "$required" = "required" ]; then
      log "ERROR" "Required app directory apps/$app is missing from the runtime image"
      return 1
    fi
    log "WARN" "Optional app directory apps/$app not found; skipping apps.txt registration"
    return
  fi

  compose_exec backend sh -c "touch sites/apps.txt"
  if compose_exec backend sh -c "grep -qx '$app' sites/apps.txt"; then
    log "INFO" "$app already present in sites/apps.txt"
    return
  fi

  compose_exec backend sh -c "printf '%s\n' '$app' >> sites/apps.txt"
  log "INFO" "Added $app to sites/apps.txt"
}

sync_bench_app_registry() {
  log_step "Synchronizing bench app registry"
  ensure_app_in_apps_txt "frappe" "required"
  ensure_app_in_apps_txt "erpnext" "required"
  if [ "$INSTALL_PAYMENTS" = "1" ]; then
    ensure_app_in_apps_txt "payments" "required"
  else
    log "INFO" "Payments apps.txt registration skipped by INSTALL_PAYMENTS=0"
  fi
  ensure_app_in_apps_txt "zolexora_core" "required"
  ensure_app_in_apps_txt "zolexora_branding" "required"
  ensure_app_in_apps_txt "zolexora_platform" "required"
  ensure_app_in_apps_txt "zolexora_integrations" "required"
}

site_exists() {
  compose_exec backend test -d "sites/$SITE"
}

app_installed() {
  local app="$1"
  compose_exec backend bench --site "$SITE" list-apps | awk '{print $1}' | grep -qx "$app"
}

doctype_exists() {
  local doctype="$1"
  compose_exec backend bench --site "$SITE" mariadb -N -e "select name from tabDocType where name='$doctype';" | grep -qx "$doctype"
}

payments_partial_state_exists() {
  app_installed "payments" && ! doctype_exists "Payment Gateway"
}

validate_payments_state() {
  log_step "Validating Payments state"

  if payments_partial_state_exists; then
    log "ERROR" "Detected partial Payments state: payments is listed as installed but Payment Gateway DocType is missing"
    log "ERROR" "Use a clean local/staging site volume or a Frappe-supported uninstall/cleanup before certification"
    return 1
  fi

  if [ "$INSTALL_PAYMENTS" = "1" ]; then
    log "INFO" "Payments installation enabled by INSTALL_PAYMENTS=1"
    return
  fi

  log "INFO" "Payments install disabled by INSTALL_PAYMENTS=0"
}

install_app_if_missing() {
  local app="$1"
  local label="$2"
  local required="${3:-required}"
  log_step "Installing $label"
  if ! app_available "$app"; then
    if [ "$required" = "required" ]; then
      log "ERROR" "Required app $app is not available in the runtime image"
      return 1
    fi
    log "WARN" "$app app directory is not available in the runtime image; skipping"
    return
  fi
  if app_installed "$app"; then
    log "INFO" "$app is already installed; skipping"
    return
  fi
  compose_exec backend bench --site "$SITE" install-app "$app"
}

wait_for_health() {
  local service="$1"
  local container="$2"
  local attempts="${3:-40}"

  for _ in $(seq 1 "$attempts"); do
    status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || true)
    if [ "$status" = "healthy" ] || [ "$status" = "running" ]; then
      echo "$service is $status."
      return
    fi
    sleep 3
  done

  echo "$service did not become healthy. Last status: ${status:-unknown}"
  docker compose -f compose.yaml logs --no-color --tail=80 "$service" || true
  return 1
}

log_step "Starting Docker services"
docker compose -f compose.yaml up -d mariadb redis-cache redis-queue redis-socketio backend

log_step "Configuring Frappe services"
compose_exec backend configure-common-site

log_step "Creating Site"
if site_exists; then
  echo "Site $SITE already exists; skipping creation."
else
  compose_exec backend bench new-site "$SITE" \
    --db-host mariadb \
    --db-root-username "$DB_ROOT" \
    --db-root-password "$DB_ROOT_PASS" \
    --admin-password "$ADMIN_PASS" \
    --install-app erpnext \
    --set-default
fi

ensure_site_database_network_access
sync_bench_app_registry

validate_payments_state
if [ "$INSTALL_PAYMENTS" = "1" ]; then
  install_app_if_missing "payments" "Payments" "required"
fi
install_app_if_missing "zolexora_core" "zolexora_core"

log_step "Running migrations"
compose_exec backend rm -f "sites/$SITE/locks/bench_migrate.lock"
compose_exec backend bench --site "$SITE" migrate

log_step "Validating Masters"
compose_exec backend bench --site "$SITE" execute zolexora_core.site_setup.validate_required_masters --kwargs '{"create_missing": True}'

log_step "Creating Company"
compose_exec backend bench --site "$SITE" execute zolexora_core.site_setup.setup_site --kwargs "{'create_workspaces': False}"

install_app_if_missing "zolexora_branding" "Branding"
install_app_if_missing "zolexora_platform" "Platform"
install_app_if_missing "zolexora_integrations" "Integrations"

log_step "Final migration"
compose_exec backend rm -f "sites/$SITE/locks/bench_migrate.lock"
compose_exec backend bench --site "$SITE" migrate
compose_exec backend bench --site "$SITE" enable-scheduler

log_step "Building static assets and clearing cache"
compose_exec backend bench build
compose_exec backend bench --site "$SITE" clear-cache
compose_exec backend bench --site "$SITE" clear-website-cache

log_step "Creating Workspaces"
compose_exec backend bench --site "$SITE" execute zolexora_core.site_setup.setup_site
compose_exec backend bench --site "$SITE" execute zolexora_core.site_setup.create_custom_workspaces

log_step "Starting all services"
docker compose -f compose.yaml up -d
docker compose -f compose.yaml restart scheduler worker-short worker-long socketio nginx

log_step "Final Validation"
compose_exec backend bench --site "$SITE" execute zolexora_core.site_setup.smoke_validate
wait_for_health "mariadb" "zolexora-mariadb"
wait_for_health "redis-cache" "zolexora-redis-cache"
wait_for_health "redis-queue" "zolexora-redis-queue"
wait_for_health "redis-socketio" "zolexora-redis-socketio"
wait_for_health "backend" "zolexora-backend"
wait_for_health "scheduler" "zolexora-scheduler"
wait_for_health "worker-short" "zolexora-worker-short"
wait_for_health "worker-long" "zolexora-worker-long"
wait_for_health "socketio" "zolexora-socketio"
wait_for_health "nginx" "zolexora-nginx"

printf '\nBootstrap completed successfully. Log in at http://localhost:%s\n' "${FRAPPE_PORT:-8000}"
