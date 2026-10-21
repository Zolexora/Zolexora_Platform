#!/bin/bash
set -e

# Always execute from the repository root
cd "$(dirname "$0")/../../.."
REPO_ROOT="$(pwd)"

COMPOSE_FILE="apps/platform-admin/compose.yaml"
INFISICAL_PROJECT_ID="188824cd-59ce-468f-b60f-f2da7aeefe63"
INFISICAL_ENV="dev"
INFISICAL_PATH="/platform-admin"

# Non-blocking secret injection helper
run_compose() {
  if [ -n "$INFISICAL_TOKEN" ] || [ -n "$INFISICAL_ACCESS_TOKEN" ] || { command -v infisical >/dev/null 2>&1 && infisical login status >/dev/null 2>&1; }; then
    echo "🔐 Infisical credentials detected - executing with runtime secret injection..."
    infisical run --projectId="$INFISICAL_PROJECT_ID" --env="$INFISICAL_ENV" --path="$INFISICAL_PATH" -- docker compose -f "$COMPOSE_FILE" "$@"
  else
    echo "⚠️  Infisical not authenticated or unavailable."
    echo "ℹ️  Run 'infisical login' or export INFISICAL_TOKEN to enable automatic secret injection."
    echo "ℹ️  Executing docker compose with existing environment..."
    docker compose -f "$COMPOSE_FILE" "$@"
  fi
}

ACTION="${1:-start}"

case "$ACTION" in
  start|up)
    echo "======================================"
    echo "🚀 Starting Zolexora Platform Admin Stack"
    echo "======================================"
    run_compose up -d
    echo ""
    echo "✅ Platform Admin Stack status:"
    docker compose -f "$COMPOSE_FILE" ps
    ;;
  stop|down)
    echo "🛑 Stopping Platform Admin Stack..."
    run_compose down
    ;;
  restart)
    echo "🔄 Restarting Platform Admin Stack..."
    run_compose restart
    ;;
  build)
    echo "🔨 Building Platform Admin Stack images locally..."
    run_compose build
    ;;
  pull)
    echo "📥 Pulling prebuilt images..."
    docker compose -f "$COMPOSE_FILE" pull --ignore-pull-failures || true
    ;;
  status|ps)
    docker compose -f "$COMPOSE_FILE" ps
    ;;
  logs)
    shift || true
    docker compose -f "$COMPOSE_FILE" logs -f "$@"
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|build|pull|status|logs}"
    exit 1
    ;;
esac
