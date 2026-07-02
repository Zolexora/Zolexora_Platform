#!/bin/bash
set -euo pipefail

CURRENT_STEP="bootstrap"

log_step() {
  CURRENT_STEP="$1"
  printf '\n✔ %s\n' "$CURRENT_STEP"
}

fail_report() {
  local exit_code=$?
  printf '\nBootstrap failed\n'
  printf 'Step: %s\n' "$CURRENT_STEP"
  printf 'Exit code: %s\n' "$exit_code"
  printf 'Suggested remediation: review the exception above, fix the failing bootstrap phase, then rerun ./scripts/init-site.sh.\n'
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

compose_exec() {
  docker compose -f compose.yaml exec -T "$@"
}

site_exists() {
  compose_exec backend test -d "sites/$SITE"
}

app_installed() {
  local app="$1"
  compose_exec backend bench --site "$SITE" list-apps | awk '{print $1}' | grep -qx "$app"
}

install_app_if_missing() {
  local app="$1"
  local label="$2"
  log_step "Installing $label"
  if app_installed "$app"; then
    echo "$app is already installed; skipping."
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

install_app_if_missing "payments" "Payments"
install_app_if_missing "zolexora_core" "zolexora_core"

log_step "Running migrations"
compose_exec backend bench --site "$SITE" migrate

log_step "Validating Masters"
compose_exec backend bench --site "$SITE" execute zolexora_core.site_setup.validate_required_masters --kwargs '{"create_missing": True}'

log_step "Creating Company"
compose_exec backend bench --site "$SITE" execute zolexora_core.site_setup.setup_site --kwargs "{'create_workspaces': False}"

install_app_if_missing "zolexora_branding" "Branding"
install_app_if_missing "zolexora_platform" "Platform"
install_app_if_missing "zolexora_integrations" "Integrations"

log_step "Final migration"
compose_exec backend bench --site "$SITE" migrate
compose_exec backend bench --site "$SITE" clear-cache
compose_exec backend bench --site "$SITE" enable-scheduler

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
