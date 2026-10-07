#!/bin/bash
set -euo pipefail

SCRIPT_NAME="status"

log() {
  local level="$1"
  shift
  printf '%s [%s] [%s] %s\n' "$(date -Iseconds)" "$level" "$SCRIPT_NAME" "$*"
}

if [ ! -f .env ]; then
  log "ERROR" "missing .env"
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

section() {
  printf '\n## %s\n' "$1"
}

log "INFO" "Zolexora operational status for $SITE"
printf 'Site URL: http://localhost:%s\n' "$HTTP_PORT"

section "Containers"
docker compose -f compose.yaml ps || true

section "Resource Usage"
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' || true

section "Disk Usage"
df -h . storage/backups sites 2>/dev/null || df -h .

section "Database"
compose_exec mariadb mariadb -uroot "-p${MYSQL_ROOT_PASSWORD}" -N -e \
  "SELECT table_schema, ROUND(SUM(data_length+index_length)/1024/1024,2) AS mb FROM information_schema.tables GROUP BY table_schema ORDER BY mb DESC LIMIT 10;" || true

section "Redis"
for service in redis-cache redis-queue redis-socketio; do
  printf '%s: ' "$service"
  compose_exec "$service" redis-cli info memory | awk -F: '/used_memory_human/ {print $2}' | tr -d '\r' || true
done

section "Queue Depth"
compose_exec redis-queue redis-cli --scan --pattern 'queue:*' | while read -r queue; do
  [ -n "$queue" ] || continue
  depth=$(compose_exec redis-queue redis-cli llen "$queue" 2>/dev/null || printf 'unknown')
  printf '%s %s\n' "$queue" "$depth"
done || true

section "Scheduler And Workers"
for service in scheduler worker-short worker-long socketio; do
  printf '%s: ' "$service"
  compose_exec "$service" sh -c "tr '\\0' ' ' </proc/1/cmdline" || true
done

section "Recent Errors"
docker compose -f compose.yaml logs --no-color --tail=200 2>/dev/null | grep -Ei 'error|exception|traceback|critical' | tail -40 || true

section "Latest Backup"
latest_backup=$(find storage/backups -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort | tail -n 1 || true)
if [ -n "$latest_backup" ]; then
  printf '%s\n' "$latest_backup"
  find "$latest_backup" -maxdepth 1 -type f -printf '%f %s bytes\n' | sort
else
  printf 'No backup directory found.\n'
fi

section "Installed App Versions"
compose_exec backend bench --site "$SITE" list-apps || true

log "INFO" "status report complete"
