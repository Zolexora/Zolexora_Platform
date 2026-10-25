#!/bin/bash
set -e

# Always execute from the repository root
cd "$(dirname "$0")/../../.."
REPO_ROOT="$(pwd)"

COMPOSE_FILE="products/zolexora-appsuite/compose.yaml"
ENV_FILE="products/zolexora-appsuite/.env"

# Auto-generate .env from .env.example if missing
if [ ! -f "$ENV_FILE" ] && [ -f "products/zolexora-appsuite/.env.example" ]; then
  echo "ℹ️  Generating products/zolexora-appsuite/.env from template..."
  cp "products/zolexora-appsuite/.env.example" "$ENV_FILE"
fi

run_compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

ACTION="${1:-start}"

case "$ACTION" in
  start|up)
    echo "=================================================="
    echo "🚀 Starting Zolexora App Suite Stack (Nginx Gateway)"
    echo "=================================================="
    run_compose up -d
    echo ""
    echo "✅ Zolexora App Suite Stack status:"
    run_compose ps
    echo ""
    echo "🌐 Unified Gateway available at: http://localhost:${APPSUITE_PORT:-3070}"
    echo "   - Client Portal:     http://localhost:${APPSUITE_PORT:-3070}/"
    echo "   - DevTeam Console:   http://localhost:${APPSUITE_PORT:-3070}/team/"
    echo "   - Backend Health:    http://localhost:${APPSUITE_PORT:-3070}/health"
    echo "   - Backend API:       http://localhost:${APPSUITE_PORT:-3070}/api/"
    ;;
  stop|down)
    echo "🛑 Stopping Zolexora App Suite Stack..."
    run_compose down
    ;;
  restart)
    echo "🔄 Restarting Zolexora App Suite Stack..."
    run_compose restart
    ;;
  build)
    echo "🔨 Building Zolexora App Suite images locally..."
    run_compose build
    ;;
  pull)
    echo "📥 Pulling prebuilt images from GHCR..."
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
