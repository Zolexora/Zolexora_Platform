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

verify_login_css_asset() {
  local login_html css_path asset_url
  login_html=$(curl -fsS -H "Host: $SITE" "http://127.0.0.1:${HTTP_PORT}/login") || {
    echo "Failed to fetch login page HTML from http://127.0.0.1:${HTTP_PORT}/login"
    return 1
  }

  css_path=$(echo "$login_html" | grep -oE '/assets/[^"'\'' >]+\.css(\?[^"'\'' >]*)?' | head -n 1 || true)
  if [ -z "$css_path" ]; then
    css_path=$(echo "$login_html" | grep -oE 'assets/[^"'\'' >]+\.css(\?[^"'\'' >]*)?' | head -n 1 || true)
    if [ -n "$css_path" ]; then
      css_path="/$css_path"
    fi
  fi

  if [ -z "$css_path" ]; then
    echo "No CSS asset URL found in login page HTML"
    return 1
  fi

  asset_url="http://127.0.0.1:${HTTP_PORT}${css_path}"
  curl -fsS -I -H "Host: $SITE" "$asset_url" >/dev/null
}

log "INFO" "starting healthcheck for $SITE"

check "Docker Compose services are running and healthy" bash -c \
  'docker compose -f compose.yaml ps --format json | python3 -c '"'"'import json,sys; bad=[]; [bad.append(o.get("Service","unknown")) for line in sys.stdin if line.strip() for o in [json.loads(line)] if o.get("State")!="running" or o.get("Health")=="unhealthy"]; print(",".join(bad)); sys.exit(1 if bad else 0)'"'"

check "MariaDB connectivity" compose_exec mariadb mariadb-admin ping -h localhost -uroot "-p${MYSQL_ROOT_PASSWORD}"
check "Redis cache ping" compose_exec redis-cache redis-cli ping
check "Redis queue ping" compose_exec redis-queue redis-cli ping
check "Redis socketio ping" compose_exec redis-socketio redis-cli ping
check "Backend HTTP availability" compose_exec backend curl -fsS -H "Host: $SITE" http://localhost:8000/api/method/ping
check "Frontend HTTP ping" curl -fsS -H "Host: $SITE" "http://127.0.0.1:${HTTP_PORT}/api/method/ping"
check "Login CSS asset extraction and availability" verify_login_css_asset
check "Branding static CSS availability" curl -fsS -I -H "Host: $SITE" "http://127.0.0.1:${HTTP_PORT}/assets/zolexora_branding/css/login.css"
check "Zolexora dark theme CSS availability" curl -fsS -I -H "Host: $SITE" "http://127.0.0.1:${HTTP_PORT}/assets/zolexora_branding/css/zolexora_dark.css"
check "Branding static logo availability" curl -fsS -I -H "Host: $SITE" "http://127.0.0.1:${HTTP_PORT}/assets/zolexora_branding/images/logo.svg"
check "Zolexora logo SVG availability" curl -fsS -I -H "Host: $SITE" "http://127.0.0.1:${HTTP_PORT}/assets/zolexora_branding/img/zolexora-logo.svg"
check "Zolexora icon SVG availability" curl -fsS -I -H "Host: $SITE" "http://127.0.0.1:${HTTP_PORT}/assets/zolexora_branding/img/zolexora-icon.svg"
check "Zolexora favicon SVG availability" curl -fsS -I -H "Host: $SITE" "http://127.0.0.1:${HTTP_PORT}/assets/zolexora_branding/img/favicon.svg"
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
