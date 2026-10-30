#!/bin/bash
set -e

# Always execute from the repository root
cd "$(dirname "$0")/../../.."
REPO_ROOT="$(pwd)"

COMPOSE_FILE="products/zolexora-tms/compose.yaml"
WITH_SECRETS="products/zolexora-tms/scripts/with-secrets.sh"

# All secrets come from Infisical via the shared wrapper (non-blocking)
run_compose() {
  bash "$WITH_SECRETS" docker compose -f "$COMPOSE_FILE" "$@"
}

start_stack() {
  echo "======================================"
  echo "🚀 Starting Zolexora TMS Stack"
  echo "======================================"
  run_compose up -d "$@"
  echo ""
  echo "✅ Zolexora TMS Stack status:"
  docker compose -f "$COMPOSE_FILE" ps
}

# Subcommand parsing
ACTION=""
if [ $# -gt 0 ]; then
  ACTION="$1"
  shift
elif [ ! -t 0 ]; then
  ACTION="start"
else
  # Interactive mode without arguments
  echo "======================================"
  echo " Zolexora TMS - Docker Infrastructure"
  echo "======================================"
  echo "Which action would you like to perform?"
  echo "1) Start / Up all services (Default)"
  echo "2) Stop / Down all services"
  echo "3) Restart all services"
  echo "4) Build all services locally"
  echo "5) Pull latest images from GHCR"
  echo "6) Status / PS"
  echo "7) View Logs"
  echo "0) Cancel"
  echo "======================================"
  read -p "Select an option [1]: " OPTION
  OPTION=${OPTION:-1}
  case "$OPTION" in
    1) ACTION="start" ;;
    2) ACTION="stop" ;;
    3) ACTION="restart" ;;
    4) ACTION="build" ;;
    5) ACTION="pull" ;;
    6) ACTION="status" ;;
    7) ACTION="logs" ;;
    0) echo "Cancelled."; exit 0 ;;
    *) echo "Invalid option. Exiting."; exit 1 ;;
  esac
fi

case "$ACTION" in
  start|up)
    start_stack "$@"
    ;;
  stop|down)
    echo "🛑 Stopping Zolexora TMS Stack..."
    docker compose -f "$COMPOSE_FILE" down "$@"
    echo "All services stopped."
    ;;
  restart)
    echo "🔄 Restarting Zolexora TMS Stack..."
    docker compose -f "$COMPOSE_FILE" down
    start_stack "$@"
    ;;
  build)
    echo "🔨 Building Zolexora TMS Containers..."
    run_compose build "$@"
    ;;
  pull)
    echo "📥 Pulling Zolexora TMS images from GHCR..."
    run_compose pull "$@"
    ;;
  status|ps)
    docker compose -f "$COMPOSE_FILE" ps "$@"
    ;;
  logs)
    if [ $# -eq 0 ]; then
      docker compose -f "$COMPOSE_FILE" logs -f
    else
      docker compose -f "$COMPOSE_FILE" logs "$@"
    fi
    ;;
  *)
    echo "Usage: $0 {start|up|stop|down|restart|build|pull|status|ps|logs} [services...]"
    exit 1
    ;;
esac
