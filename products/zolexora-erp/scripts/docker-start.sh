#!/bin/bash
set -e

# Always execute from the monorepo root
cd "$(dirname "$0")/../../.."
REPO_ROOT="$(pwd)"

PRODUCT="$(basename "$(dirname "$(dirname "$0")")")"
COMPOSE_FILE="products/${PRODUCT}/compose.yaml"

# Secrets come only from Infisical (products/<product>/.infisical.json); no .env, no fallback.
run_compose() {
  bash scripts/setup/with-infisical.sh "products/${PRODUCT}" docker compose -f "$COMPOSE_FILE" "$@"
}

start_stack() {
  echo "======================================"
  echo "🚀 Starting ${PRODUCT} Stack"
  echo "======================================"
  run_compose pull --ignore-pull-failures "$@"
  run_compose up -d "$@"
  echo ""
  echo "✅ ${PRODUCT} Stack status:"
  docker compose -f "$COMPOSE_FILE" ps
}

ACTION=""
if [ $# -gt 0 ]; then
  ACTION="$1"
  shift
elif [ ! -t 0 ]; then
  ACTION="start"
else
  echo "======================================"
  echo " ${PRODUCT} - Docker Infrastructure"
  echo "======================================"
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
    echo "🛑 Stopping ${PRODUCT} Stack..."
    docker compose -f "$COMPOSE_FILE" down "$@"
    echo "All services stopped."
    ;;
  restart)
    echo "🔄 Restarting ${PRODUCT} Stack..."
    docker compose -f "$COMPOSE_FILE" down
    start_stack "$@"
    ;;
  build)
    echo "🔨 Building ${PRODUCT} Containers..."
    run_compose build "$@"
    ;;
  pull)
    echo "📥 Pulling ${PRODUCT} images from GHCR..."
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
