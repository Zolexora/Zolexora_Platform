#!/bin/bash
set -e

# Always execute from the repository root
cd "$(dirname "$0")/../../.."
REPO_ROOT="$(pwd)"

COMPOSE_FILE="products/zolexora-appsuite/compose.yaml"
ENV_FILE="products/zolexora-appsuite/.env"
INFISICAL_CONFIG="products/zolexora-appsuite/.infisical.json"

# Auto-generate .env from .env.example if missing
if [ ! -f "$ENV_FILE" ] && [ -f "products/zolexora-appsuite/.env.example" ]; then
  echo "ℹ️  Generating products/zolexora-appsuite/.env from template..."
  cp "products/zolexora-appsuite/.env.example" "$ENV_FILE"
fi

# Detect configured ingress port from .env or environment
if [ -f "$ENV_FILE" ]; then
  FILE_PORT=$(grep -E "^APPSUITE_PORT=" "$ENV_FILE" 2>/dev/null | cut -d '=' -f 2 | tr -d ' "' || true)
  [ -n "$FILE_PORT" ] && APPSUITE_PORT="${APPSUITE_PORT:-$FILE_PORT}"
fi
APPSUITE_PORT="${APPSUITE_PORT:-3270}"

run_compose() {
  if [ -f "$INFISICAL_CONFIG" ] && { [ -n "$INFISICAL_TOKEN" ] || [ -n "$INFISICAL_ACCESS_TOKEN" ] || { command -v infisical >/dev/null 2>&1 && infisical login status >/dev/null 2>&1; }; }; then
    WORKSPACE_ID=$(python3 -c "import json; d=json.load(open('$INFISICAL_CONFIG')); print(d.get('workspaceId',''))" 2>/dev/null || echo "188824cd-59ce-468f-b60f-f2da7aeefe63")
    SECRET_PATH=$(python3 -c "import json; d=json.load(open('$INFISICAL_CONFIG')); print(d.get('secretsPath','/Zolexora_AppSuite'))" 2>/dev/null || echo "/Zolexora_AppSuite")
    ENV_SLUG=$(python3 -c "import json; d=json.load(open('$INFISICAL_CONFIG')); print(d.get('defaultEnvironment','dev'))" 2>/dev/null || echo "dev")
    PROJECT_FLAG=""
    [ -n "$WORKSPACE_ID" ] && PROJECT_FLAG="--projectId=$WORKSPACE_ID"

    echo "🔐 Infisical credentials detected — injecting runtime cloud secrets ($SECRET_PATH, env: $ENV_SLUG)..."
    infisical run $PROJECT_FLAG --path="$SECRET_PATH" --env="$ENV_SLUG" -- docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
  else
    echo "ℹ️  Executing docker compose with local .env file..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
  fi
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
