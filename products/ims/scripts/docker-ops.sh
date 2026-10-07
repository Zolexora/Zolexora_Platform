#!/usr/bin/env bash
# ==============================================================================
# Zolexora IMS — Docker & Container Management Operations
# Commands: build, up, down, restart, logs, ps, shell, clean, push
# Usage: ./scripts/docker-ops.sh [COMMAND] [OPTIONS]
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

COMPOSE_FILE="${ROOT_DIR}/docker-compose.yml"

print_help() {
  echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}${BOLD}║             ZOLEXORA IMS — DOCKER CONTAINER OPERATIONS               ║${NC}"
  echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════════════════════════╝${NC}"
  echo -e "${BOLD}Usage:${NC} ./scripts/docker-ops.sh <command> [service/options]"
  echo ""
  echo -e "${BOLD}Commands:${NC}"
  echo "  up                Build and start all containers in background"
  echo "  down              Stop and remove all running containers"
  echo "  build [service]   Build images (optional: user-api | admin-api | user-web | admin-web)"
  echo "  restart [service] Restart all or specified container"
  echo "  logs [service]    Tail logs with timestamps and colors"
  echo "  ps                Display container status, ports, and health"
  echo "  shell <service>   Open interactive bash shell inside container"
  echo "  clean             Prune dangling images, unused volumes, and stopped containers"
  echo "  push <registry>   Tag and push images to container registry (e.g. ghcr.io/org)"
  echo "  help              Show this help manual"
  echo ""
  echo -e "${BOLD}Available Services:${NC}"
  echo "  • user-api        (Core FastAPI: 8000)"
  echo "  • admin-api       (Admin FastAPI: 8001)"
  echo "  • user-web        (POS & Inventory Frontend: 3000)"
  echo "  • admin-web       (SuperAdmin Control Center: 3001)"
  exit 0
}

check_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: Docker is not installed or not in PATH.${NC}"
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: Docker daemon is not running or current user lacks permissions.${NC}"
    exit 1
  fi
}

cmd_up() {
  check_docker
  echo -e "${BLUE}${BOLD}🚀 Starting Zolexora IMS Docker Stack...${NC}"
  docker compose -f "${COMPOSE_FILE}" up -d --build
  echo -e "${GREEN}✓ Container stack initiated in background.${NC}\n"
  cmd_ps
}

cmd_down() {
  check_docker
  echo -e "${YELLOW}${BOLD}🛑 Stopping Zolexora IMS Docker Stack...${NC}"
  docker compose -f "${COMPOSE_FILE}" down
  echo -e "${GREEN}✓ All containers stopped and removed.${NC}"
}

cmd_build() {
  check_docker
  local svc="${1:-}"
  if [[ -n "${svc}" ]]; then
    echo -e "${BLUE}${BOLD}🔨 Building container service: ${svc}...${NC}"
    docker compose -f "${COMPOSE_FILE}" build "${svc}"
  else
    echo -e "${BLUE}${BOLD}🔨 Building all container images in parallel...${NC}"
    docker compose -f "${COMPOSE_FILE}" build
  fi
  echo -e "${GREEN}✓ Container build completed successfully.${NC}"
}

cmd_restart() {
  check_docker
  local svc="${1:-}"
  if [[ -n "${svc}" ]]; then
    echo -e "${CYAN}Restarting ${svc}...${NC}"
    docker compose -f "${COMPOSE_FILE}" restart "${svc}"
  else
    echo -e "${CYAN}Restarting all services...${NC}"
    docker compose -f "${COMPOSE_FILE}" restart
  fi
  echo -e "${GREEN}✓ Restart complete.${NC}"
}

cmd_logs() {
  check_docker
  local svc="${1:-}"
  echo -e "${CYAN}Tailing logs for ${svc:-all services} (Press Ctrl+C to exit)...${NC}"
  docker compose -f "${COMPOSE_FILE}" logs -f --tail=100 ${svc}
}

cmd_ps() {
  check_docker
  echo -e "${BOLD}Current Container Status:${NC}"
  docker compose -f "${COMPOSE_FILE}" ps
}

cmd_shell() {
  check_docker
  local svc="${1:-}"
  if [[ -z "${svc}" ]]; then
    echo -e "${RED}❌ Service name required for shell.${NC}"
    echo "Options: user-api | admin-api | user-web | admin-web"
    exit 1
  fi
  echo -e "${CYAN}Connecting to ${svc}...${NC}"
  docker compose -f "${COMPOSE_FILE}" exec -it "${svc}" /bin/sh 2>/dev/null || docker compose -f "${COMPOSE_FILE}" exec -it "${svc}" /bin/bash
}

cmd_clean() {
  check_docker
  echo -e "${YELLOW}${BOLD}🧹 Pruning unused Docker resources...${NC}"
  docker compose -f "${COMPOSE_FILE}" down --remove-orphans
  docker system prune -f --volumes
  echo -e "${GREEN}✓ Docker resources pruned successfully.${NC}"
}

cmd_push() {
  check_docker
  local registry="${1:-}"
  if [[ -z "${registry}" ]]; then
    echo -e "${RED}❌ Registry prefix required. Example: ./scripts/docker-ops.sh push ghcr.io/my-org${NC}"
    exit 1
  fi

  local images=(
    "zolexora-user-backend:latest|${registry}/zolexora-user-backend:latest"
    "zolexora-admin-backend:latest|${registry}/zolexora-admin-backend:latest"
    "zolexora-user-frontend:latest|${registry}/zolexora-user-frontend:latest"
    "zolexora-admin-frontend:latest|${registry}/zolexora-admin-frontend:latest"
  )

  echo -e "${BLUE}${BOLD}Tagging and pushing images to ${registry}...${NC}"
  for pair in "${images[@]}"; do
    IFS="|" read -r local_tag remote_tag <<< "${pair}"
    echo -e "  • Tagging ${local_tag} -> ${remote_tag}"
    docker tag "${local_tag}" "${remote_tag}"
    echo -e "  • Pushing ${remote_tag}..."
    docker push "${remote_tag}"
  done
  echo -e "${GREEN}✓ All container images successfully pushed to registry.${NC}"
}

# Main routing
COMMAND="${1:-help}"
shift || true

case "${COMMAND}" in
  up|start)
    cmd_up
    ;;
  down|stop)
    cmd_down
    ;;
  build)
    cmd_build "$@"
    ;;
  restart)
    cmd_restart "$@"
    ;;
  logs)
    cmd_logs "$@"
    ;;
  ps|status)
    cmd_ps
    ;;
  shell|exec)
    cmd_shell "$@"
    ;;
  clean|prune)
    cmd_clean
    ;;
  push)
    cmd_push "$@"
    ;;
  help|-h|--help)
    print_help
    ;;
  *)
    echo -e "${RED}Unknown command: ${COMMAND}${NC}\n"
    print_help
    ;;
esac
