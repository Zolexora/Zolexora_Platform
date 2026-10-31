#!/bin/bash
set -e

# Always execute from the repository root
cd "$(dirname "$0")/../../.."
REPO_ROOT="$(pwd)"

COMPOSE_FILE="apps/zolexora-platform-admin/compose.yaml"
# Secrets come only from Infisical (apps/zolexora-platform-admin/.infisical.json); no fallback.
run_compose() {
  bash scripts/setup/with-infisical.sh apps/zolexora-platform-admin docker compose -f "$COMPOSE_FILE" "$@"
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
