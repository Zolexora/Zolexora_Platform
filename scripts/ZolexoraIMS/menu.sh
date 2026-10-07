#!/usr/bin/env bash
# ==============================================================================
# Zolexora IMS — Interactive CLI Control Center
# Unified interactive dashboard to run any deployment, ops, or test script
# Usage: ./scripts/menu.sh
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

show_menu() {
  clear
  echo -e "${CYAN}${BOLD}"
  echo "╔══════════════════════════════════════════════════════════════════════╗"
  echo "║                   ZOLEXORA IMS — DEVELOPER HUB                       ║"
  echo "║              Interactive Operations & Deployment Center              ║"
  echo "╚══════════════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
  echo -e "${BOLD}Select an operation:${NC}\n"
  echo -e "  ${CYAN}[1]${NC} 🚀 Deploy Application Stack     (Render, Cloudflare Pages, Docker)"
  echo -e "  ${CYAN}[2]${NC} 🩺 Run System Health Check       (Probe all APIs, frontends & latency)"
  echo -e "  ${CYAN}[3]${NC} 🐳 Docker Container Operations   (Up, down, build, restart, logs, shell)"
  echo -e "  ${CYAN}[4]${NC} 📦 Database Migrations & Seeds   (Cloudflare D1 schema, tables & seed)"
  echo -e "  ${CYAN}[5]${NC} 🧪 Run Production Quality Gates  (Pytest suite, TypeScript, build tests)"
  echo -e "  ${CYAN}[6]${NC} 🔐 Audit Environment & Secrets   (Check .env.local, generate keys)"
  echo -e "  ${CYAN}[7]${NC} ⚡ Start Local Monorepo Dev      (Run native Vite & FastAPI dev processes)"
  echo -e "  ${CYAN}[8]${NC} 📦 Run Full Setup Script         (Install CLIs, MCP servers, and cloud auth)"
  echo -e "  ${CYAN}[0]${NC} 🚪 Exit"
  echo ""
  echo -n -e "${BOLD}Enter choice [0-8]: ${NC}"
}

run_action() {
  local choice="$1"
  case "$choice" in
    1)
      echo ""
      "${SCRIPT_DIR}/deploy.sh"
      ;;
    2)
      echo ""
      "${SCRIPT_DIR}/health-check.sh"
      ;;
    3)
      echo ""
      echo -e "${BOLD}Docker Subcommands:${NC} up | down | build | ps | logs | clean"
      read -r -p "Enter docker command [up]: " dcmd
      dcmd="${dcmd:-up}"
      "${SCRIPT_DIR}/docker-ops.sh" "${dcmd}"
      ;;
    4)
      echo ""
      echo -e "${BOLD}Database Subcommands:${NC} migrate | seed | status | backup"
      read -r -p "Enter database command [status]: " dbcmd
      dbcmd="${dbcmd:-status}"
      "${SCRIPT_DIR}/db-ops.sh" "${dbcmd}"
      ;;
    5)
      echo ""
      "${SCRIPT_DIR}/test-all.sh"
      ;;
    6)
      echo ""
      "${SCRIPT_DIR}/sync-env.sh" audit
      ;;
    7)
      echo ""
      echo -e "${GREEN}Starting Monorepo development stack with pnpm...${NC}"
      cd "${ROOT_DIR}" && pnpm dev:user:frontend
      ;;
    8)
      echo ""
      "${SCRIPT_DIR}/setup.sh"
      ;;
    0)
      echo -e "\n${GREEN}Goodbye!${NC}"
      exit 0
      ;;
    *)
      echo -e "\n${RED}Invalid option!${NC}"
      ;;
  esac
  echo ""
  read -r -p "Press [Enter] to return to menu..."
}

# If arguments passed, dispatch directly; otherwise interactive menu
if [[ $# -gt 0 ]]; then
  run_action "$1"
else
  while true; do
    show_menu
    read -r choice
    run_action "$choice"
  done
fi
