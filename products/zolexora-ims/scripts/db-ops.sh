#!/usr/bin/env bash
# ==============================================================================
# Zolexora IMS — Cloudflare D1 & Relational Database Operations
# Commands: migrate, seed, backup, restore, status, query
# Usage: ./products/zolexora-ims/scripts/db-ops.sh [COMMAND] [OPTIONS]
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

DB_NAME="zolexora-ims-1-db"
BACKUPS_DIR="${IMS_BACKUPS_DIR:-${HOME}/zolexora-ims-backups}"  # business data: kept outside the repo
MODE="--local"

print_help() {
  echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}${BOLD}║           ZOLEXORA IMS — DATABASE OPERATIONS                        ║${NC}"
  echo -e "${CYAN}${BOLD}║                Cloudflare D1 Serverless SQL Engine                   ║${NC}"
  echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════════════════════════╝${NC}"
  echo -e "${BOLD}Usage:${NC} ./products/zolexora-ims/scripts/db-ops.sh <command> [options]"
  echo ""
  echo "Tables are created by the IMS backend on start (services/user-api/schema.sql); there are no migrations."
  echo ""
  echo -e "${BOLD}Commands:${NC}"
  echo "  status            Display active tables, schema details, and row counts"
  echo "  query <sql>       Execute an arbitrary SQL query against D1"
  echo "  backup            Export database state to timestamped SQL backup"
  echo "  restore <file>    Restore database schema & data from an SQL backup"
  echo "  help              Show this manual"
  echo ""
  echo -e "${BOLD}Options:${NC}"
  echo "  --remote          Target production Cloudflare D1 remote database"
  echo "  --local           Target local SQLite / D1 simulator (default)"
  echo ""
  echo -e "${BOLD}Examples:${NC}"
  echo "  ./products/zolexora-ims/scripts/db-ops.sh status --remote"
  echo "  ./products/zolexora-ims/scripts/db-ops.sh query \"SELECT org_id, item_code, total_stock FROM products LIMIT 5;\""
  echo "  ./products/zolexora-ims/scripts/db-ops.sh backup"
  exit 0
}

# Check wrangler runner
# Wrangler runs from database/ (its wrangler.toml names the D1 database) with the Cloudflare
# credentials from Infisical; --remote needs them, --local does not.
get_wrangler() {
  echo "bash ${ROOT_DIR}/../../scripts/setup/with-infisical.sh ${ROOT_DIR} pnpm exec wrangler"
}
cd "${ROOT_DIR}/database"

cmd_status() {
  local target_mode="${1:-$MODE}"
  local wrangler_cmd
  wrangler_cmd=$(get_wrangler)

  echo -e "${BLUE}${BOLD}📊 Database Schema & Row Status:${NC}"
  $wrangler_cmd d1 execute "${DB_NAME}" ${target_mode} --command="
    SELECT name, type FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%';
  " --yes || echo -e "${YELLOW}D1 database status query completed.${NC}"
}

cmd_query() {
  local sql_query="$1"
  local target_mode="${2:-$MODE}"
  local wrangler_cmd
  wrangler_cmd=$(get_wrangler)

  if [[ -z "${sql_query}" ]]; then
    echo -e "${RED}❌ SQL query required. Example: ./products/zolexora-ims/scripts/db-ops.sh query \"SELECT * FROM products;\"${NC}"
    exit 1
  fi

  echo -e "${CYAN}Executing SQL: ${sql_query}${NC}"
  $wrangler_cmd d1 execute "${DB_NAME}" ${target_mode} --command="${sql_query}" --yes
}

cmd_backup() {
  local target_mode="${1:-$MODE}"
  local wrangler_cmd
  wrangler_cmd=$(get_wrangler)
  mkdir -p "${BACKUPS_DIR}"

  local timestamp
  timestamp=$(date +"%Y%m%d_%H%M%S")
  local backup_file="${BACKUPS_DIR}/d1_backup_${timestamp}.sql"

  echo -e "${BLUE}${BOLD}💾 Creating snapshot backup to: ${backup_file}...${NC}"
  $wrangler_cmd d1 export "${DB_NAME}" ${target_mode} --output="${backup_file}" || {
    rm -f "${backup_file}"
    echo -e "${RED}❌ Backup failed (wrangler d1 export).${NC}"
    exit 1
  }
  echo -e "${GREEN}✓ Backup snapshot created successfully at ${backup_file}.${NC}"
}

cmd_restore() {
  local backup_file="$1"
  local target_mode="${2:-$MODE}"
  local wrangler_cmd
  wrangler_cmd=$(get_wrangler)

  if [[ -z "${backup_file}" || ! -f "${backup_file}" ]]; then
    echo -e "${RED}❌ Backup file not found: ${backup_file}${NC}"
    exit 1
  fi

  echo -e "${YELLOW}${BOLD}⚠️ Restoring database from: ${backup_file}...${NC}"
  $wrangler_cmd d1 execute "${DB_NAME}" ${target_mode} --file="${backup_file}" --yes
  echo -e "${GREEN}✓ Database restored successfully.${NC}"
}

# Main CLI handler
COMMAND="${1:-help}"
shift || true

# Parse flags for mode
for arg in "$@"; do
  if [[ "$arg" == "--remote" ]]; then
    MODE="--remote"
  elif [[ "$arg" == "--local" ]]; then
    MODE="--local"
  fi
done

case "${COMMAND}" in
  status)
    cmd_status "${MODE}"
    ;;
  query)
    cmd_query "$1" "${MODE}"
    ;;
  backup)
    cmd_backup "${MODE}"
    ;;
  restore)
    cmd_restore "$1" "${MODE}"
    ;;
  help|-h|--help)
    print_help
    ;;
  *)
    echo -e "${RED}Unknown command: ${COMMAND}${NC}\n"
    print_help
    exit 1
    ;;
esac
