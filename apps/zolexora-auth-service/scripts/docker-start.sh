#!/bin/bash
set -e

# Always execute from the repository root
cd "$(dirname "$0")/../../.."
REPO_ROOT="$(pwd)"

COMPOSE_FILE="apps/zolexora-auth-service/compose.yaml"
# All secrets come from Infisical (apps/zolexora-auth-service/.infisical.json)
run_compose() {
  bash scripts/setup/with-infisical.sh apps/zolexora-auth-service docker compose -f "$COMPOSE_FILE" "$@"
}

ACTION="${1:-start}"

case "$ACTION" in
  start|up)
    echo "======================================"
    echo "🚀 Starting Zolexora Auth Service Stack"
    echo "======================================"
    docker compose -f "$COMPOSE_FILE" pull --ignore-pull-failures || true
    run_compose up -d
    echo ""
    echo "✅ Auth Service Stack status:"
    docker compose -f "$COMPOSE_FILE" ps
    ;;
  stop|down)
    echo "🛑 Stopping Auth Service Stack..."
    run_compose down
    ;;
  restart)
    echo "🔄 Restarting Auth Service Stack..."
    run_compose restart
    ;;
  build)
    echo "🔨 Building Auth Service images locally..."
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
