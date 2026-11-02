#!/bin/bash
set -e

# Always execute from the repository root
cd "$(dirname "$0")/../../.."

COMPOSE_FILE="apps/zolexora-auth-service/compose.yaml"
# Every compose call goes through Infisical: compose.yaml has no defaults and fails without it.
run_compose() {
  bash scripts/setup/with-infisical.sh apps/zolexora-auth-service docker compose -f "$COMPOSE_FILE" "$@"
}

ACTION="${1:-start}"

case "$ACTION" in
  start|up)
    echo "======================================"
    echo "🚀 Starting Zolexora Auth Service Stack"
    echo "======================================"
    run_compose pull --ignore-pull-failures || true
    run_compose up -d
    echo ""
    echo "✅ Auth Service Stack status:"
    run_compose ps
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
    run_compose pull --ignore-pull-failures || true
    ;;
  status|ps)
    run_compose ps
    ;;
  logs)
    shift || true
    run_compose logs -f "$@"
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|build|pull|status|logs}"
    exit 1
    ;;
esac
