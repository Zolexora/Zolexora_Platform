#!/bin/bash
set -e

# Resolve canonical script location even if invoked via symlink or PATH
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
  DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"
APPSUITE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APPSUITE_DIR/../.." && pwd)"

# Always execute with repository root as base
cd "$REPO_ROOT"

COMPOSE_FILE="$APPSUITE_DIR/compose.yaml"
APPSUITE_PORT="${APPSUITE_PORT:-3070}"

# Secrets come only from Infisical (products/zolexora-appsuite/.infisical.json); no .env, no fallback.
run_compose() {
  bash "$REPO_ROOT/scripts/setup/with-infisical.sh" "$APPSUITE_DIR" docker compose -f "$COMPOSE_FILE" "$@"
}

start_stack() {
  echo "=================================================="
  echo "🚀 Starting Zolexora AppSuite Stack (Nginx Gateway)"
  echo "=================================================="
  run_compose up -d "$@"
  echo ""
  echo "✅ Zolexora AppSuite Stack status:"
  run_compose ps
  echo ""
  echo "🌐 Unified Gateway available at: http://localhost:${APPSUITE_PORT}"
  echo "   - Client Portal:     http://localhost:${APPSUITE_PORT}/"
  echo "   - DevTeam Console:   http://localhost:${APPSUITE_PORT}/team/"
  echo "   - Backend Health:    http://localhost:${APPSUITE_PORT}/health"
  echo "   - Backend API:       http://localhost:${APPSUITE_PORT}/api/"
}

ACTION="${1:-start}"
shift || true

case "$ACTION" in
  start|up)
    start_stack "$@"
    ;;
  stop|down)
    echo "🛑 Stopping Zolexora AppSuite Stack..."
    run_compose down "$@"
    ;;
  restart)
    echo "=================================================="
    echo "🔄 Restarting Zolexora AppSuite Stack..."
    echo "=================================================="
    if [ $# -gt 0 ]; then
      echo "ℹ️  Restarting service(s): $*"
      run_compose restart "$@"
      echo ""
      run_compose ps
    else
      echo "🛑 Taking down existing containers to refresh secrets & networking..."
      run_compose down
      echo ""
      start_stack
    fi
    ;;
  build)
    echo "🔨 Building Zolexora AppSuite images locally..."
    run_compose build "$@"
    ;;
  pull)
    echo "📥 Pulling prebuilt images from GHCR..."
    run_compose pull --ignore-pull-failures "$@" || true
    ;;
  status|ps)
    run_compose ps "$@"
    ;;
  logs)
    run_compose logs -f "$@"
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|build|pull|status|logs} [services...]"
    exit 1
    ;;
esac
