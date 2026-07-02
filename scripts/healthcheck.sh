#!/bin/bash
set -euo pipefail

SCRIPT_NAME="healthcheck"
FAILURES=0

log() {
  local level="$1"
  shift
  printf '%s [%s] [%s] %s\n' "$(date -Iseconds)" "$level" "$SCRIPT_NAME" "$*"
}

pass() {
  log "PASS" "$1"
}

fail() {
  log "FAIL" "$1"
  FAILURES=$((FAILURES + 1))
}

check() {
  local label="$1"
  shift
  if "$@" >/tmp/zolexora-healthcheck.out 2>&1; then
    pass "$label"
  else
    fail "$label :: $(tr '\n' ' ' </tmp/zolexora-healthcheck.out | cut -c1-240)"
  fi
}

if [ ! -f .env ]; then
  fail "missing .env"
  exit 1
fi

set -a
source .env
set +a

SITE="${SITE_NAME:-site1.example.com}"
HTTP_PORT="${HTTP_PORT:-8080}"

compose_exec() {
  docker compose -f compose.yaml exec -T "$@"
}

log "INFO" "starting healthcheck for $SITE"

check "Docker Compose services are running and healthy" bash -c \
  'docker compose -f compose.yaml ps --format json | python3 -c '"'"'import json,sys; bad=[]; [bad.append(o.get("Service","unknown")) for line in sys.stdin if line.strip() for o in [json.loads(line)] if o.get("State")!="running" or o.get("Health")=="unhealthy"]; print(",".join(bad)); sys.exit(1 if bad else 0)'"'"

check "MariaDB connectivity" compose_exec mariadb mariadb-admin ping -h localhost -uroot "-p${MYSQL_ROOT_PASSWORD}"
check "Redis cache ping" compose_exec redis-cache redis-cli ping
check "Redis queue ping" compose_exec redis-queue redis-cli ping
check "Redis socketio ping" compose_exec redis-socketio redis-cli ping
check "Backend HTTP availability" compose_exec backend curl -fsS http://localhost:8000
check "Frontend HTTP ping" curl -fsS -H "Host: $SITE" "http://127.0.0.1:${HTTP_PORT}/api/method/ping"
check "Socket.IO process" compose_exec socketio sh -c "tr '\\0' ' ' </proc/1/cmdline | grep -q 'socketio.js'"
check "Scheduler process" compose_exec scheduler sh -c "tr '\\0' ' ' </proc/1/cmdline | grep -q 'frappe schedule'"
check "Short worker process" compose_exec worker-short sh -c "tr '\\0' ' ' </proc/1/cmdline | grep -q 'frappe worker --queue short'"
check "Long worker process" compose_exec worker-long sh -c "tr '\\0' ' ' </proc/1/cmdline | grep -q 'frappe worker --queue long'"
check "Site exists" compose_exec backend test -d "sites/$SITE"
check "Installed app list available" compose_exec backend bench --site "$SITE" list-apps
check "Administrator and company smoke validation" compose_exec backend bench --site "$SITE" execute zolexora_core.site_setup.smoke_validate
check "Background worker execution" compose_exec backend bench --site "$SITE" execute zolexora_core.site_setup.background_job_probe

if [ "$FAILURES" -eq 0 ]; then
  log "INFO" "healthcheck completed successfully"
  exit 0
fi

log "ERROR" "healthcheck completed with $FAILURES failure(s)"
exit 1
