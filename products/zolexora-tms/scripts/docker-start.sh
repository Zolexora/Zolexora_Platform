#!/bin/bash
set -e

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$REPO_ROOT"

COMPOSE_FILE="products/zolexora-tms/compose.yaml"
ACTION="${1:-start}"

case "$ACTION" in
  start|up)
    echo "======================================"
    echo "🚀 Starting Zolexora TMS Containers"
    echo "======================================"
    if command -v infisical >/dev/null 2>&1 && { [ -n "$INFISICAL_TOKEN" ] || infisical export --path=/zolexora-tms --env=dev >/dev/null 2>&1; }; then
      echo "🔐 Infisical credentials detected - starting with runtime injection..."
      infisical run --env=dev --path=/zolexora-tms -- docker compose -f "$COMPOSE_FILE" up -d "$@"
    else
      echo "ℹ️  Starting with existing environment variables..."
      docker compose -f "$COMPOSE_FILE" up -d
    fi
    echo ""
    echo "✅ TMS Containers running:"
    docker compose -f "$COMPOSE_FILE" ps
    ;;
  stop|down)
    echo "🛑 Stopping Zolexora TMS Containers..."
    docker compose -f "$COMPOSE_FILE" down
    ;;
  restart)
    echo "🔄 Restarting Zolexora TMS Containers..."
    docker compose -f "$COMPOSE_FILE" down
    "$0" start
    ;;
  logs)
    docker compose -f "$COMPOSE_FILE" logs -f
    ;;
  status|ps)
    docker compose -f "$COMPOSE_FILE" ps
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|logs|status}"
    exit 1
    ;;
esac
