#!/bin/bash
# Zolexora Platform — Product Docker Scaffolder & Auditor
# Usage:
#   bash scripts/dev/scaffold-product-docker.sh <product-name>
#   bash scripts/dev/scaffold-product-docker.sh --check
set -e

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$REPO_ROOT"

# Colors
GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

print_usage() {
  echo -e "${CYAN}Zolexora Platform — Product Docker Scaffolder & Auditor${NC}"
  echo "Usage:"
  echo "  $0 <product-name>       Scaffold Docker setup & GHCR workflow for a product"
  echo "  $0 --check              Audit all products in products/ for Docker & GHCR compliance"
  echo "  $0 --help               Display this help message"
  echo ""
  echo "Example:"
  echo "  $0 rentoeasy"
  echo "  $0 clarityfi"
}

# ── AUDIT MODE (--check) ─────────────────────────────────────────────────────
run_audit() {
  echo -e "\n${BLUE}================================================================${NC}"
  echo -e "${BLUE}  🔍 AUDITING DOCKER & GHCR COMPLIANCE ACROSS PRODUCTS         ${NC}"
  echo -e "${BLUE}================================================================${NC}\n"

  printf "%-24s %-12s %-16s %-14s %-12s\n" "PRODUCT" "COMPOSE" "GHCR IMAGE" "PULL POLICY" "START SCRIPT"
  echo "----------------------------------------------------------------------------------------"

  for dir in products/*/; do
    [ -d "$dir" ] || continue
    pname=$(basename "$dir")
    [ "$pname" = "README.md" ] && continue

    COMPOSE_FILE="$dir/compose.yaml"
    [ ! -f "$COMPOSE_FILE" ] && COMPOSE_FILE="$dir/docker-compose.yml"

    HAS_COMPOSE="✘ No"
    HAS_IMAGE="✘ No"
    HAS_PULL_POLICY="✘ No"
    HAS_SCRIPT="✘ No"

    if [ -f "$COMPOSE_FILE" ]; then
      HAS_COMPOSE="${GREEN}✔ Yes${NC}"
      if grep -q "image:.*ghcr.io" "$COMPOSE_FILE" 2>/dev/null; then
        HAS_IMAGE="${GREEN}✔ GHCR${NC}"
      fi
      if grep -q "pull_policy: missing" "$COMPOSE_FILE" 2>/dev/null; then
        HAS_PULL_POLICY="${GREEN}✔ missing${NC}"
      fi
    fi

    if [ -f "$dir/scripts/docker-start.sh" ]; then
      if grep -q "up -d --build" "$dir/scripts/docker-start.sh" 2>/dev/null; then
        HAS_SCRIPT="${YELLOW}⚠ Forced build${NC}"
      else
        HAS_SCRIPT="${GREEN}✔ Compliant${NC}"
      fi
    fi

    printf "%-24s %-20b %-24b %-22b %-20b\n" "$pname" "$HAS_COMPOSE" "$HAS_IMAGE" "$HAS_PULL_POLICY" "$HAS_SCRIPT"
  done
  echo ""
  exit 0
}

if [ "$1" = "--check" ]; then
  run_audit
fi

if [ "$1" = "--help" ] || [ -z "$1" ]; then
  print_usage
  exit 0
fi

PRODUCT="$1"
PRODUCT_DIR="products/$PRODUCT"

if [ ! -d "$PRODUCT_DIR" ]; then
  echo -e "${YELLOW}Notice: Directory '$PRODUCT_DIR' does not exist yet. Creating it...${NC}"
  mkdir -p "$PRODUCT_DIR"
fi

mkdir -p "$PRODUCT_DIR/scripts"
COMPOSE_FILE="$PRODUCT_DIR/compose.yaml"
START_SCRIPT="$PRODUCT_DIR/scripts/docker-start.sh"
WORKFLOW_FILE=".github/workflows/docker-ghcr-${PRODUCT}.yml"

echo -e "\n${BLUE}================================================================${NC}"
echo -e "${BLUE}  🚀 Scaffolding Docker & GHCR Setup for: ${GREEN}${PRODUCT}${NC}"
echo -e "${BLUE}================================================================${NC}\n"

# 1. Compose YAML
if [ ! -f "$COMPOSE_FILE" ]; then
  echo -e "${YELLOW}[1/3] Generating $COMPOSE_FILE...${NC}"
  cat <<EOF > "$COMPOSE_FILE"
services:
  backend:
    image: \${${PRODUCT^^}_BACKEND_IMAGE:-ghcr.io/zolexora/${PRODUCT}-backend:latest}
    pull_policy: missing
    build:
      context: .
      dockerfile: Dockerfile.api
    container_name: ${PRODUCT}-backend
    ports:
      - "\${${PRODUCT^^}_BACKEND_PORT:-4040}:4030"
    restart: unless-stopped

  web:
    image: \${${PRODUCT^^}_WEB_IMAGE:-ghcr.io/zolexora/${PRODUCT}-web:latest}
    pull_policy: missing
    build:
      context: .
      dockerfile: Dockerfile.web
    container_name: ${PRODUCT}-web
    ports:
      - "\${${PRODUCT^^}_PORT:-3095}:80"
    restart: unless-stopped
EOF
  echo -e "  ${GREEN}✔ Created $COMPOSE_FILE with GHCR tags and pull_policy: missing${NC}"
else
  echo -e "  ${GREEN}✔ $COMPOSE_FILE already exists.${NC}"
fi

# 2. docker-start.sh
if [ ! -f "$START_SCRIPT" ]; then
  echo -e "${YELLOW}[2/3] Generating $START_SCRIPT...${NC}"
  cat <<'EOF' > "$START_SCRIPT"
#!/bin/bash
set -e

# Always execute from the monorepo root
cd "$(dirname "$0")/../../.."
REPO_ROOT="$(pwd)"

PRODUCT="$(basename "$(dirname "$(dirname "$0")")")"
COMPOSE_FILE="products/${PRODUCT}/compose.yaml"
[ ! -f "$COMPOSE_FILE" ] && COMPOSE_FILE="products/${PRODUCT}/docker-compose.yml"

# Non-blocking secret injection helper
run_compose() {
  if [ -f "products/${PRODUCT}/.infisical.json" ] && { [ -n "$INFISICAL_TOKEN" ] || [ -n "$INFISICAL_ACCESS_TOKEN" ] || { command -v infisical >/dev/null 2>&1 && infisical login status >/dev/null 2>&1; }; }; then
    WORKSPACE_ID=$(python3 -c "import json; d=json.load(open('products/${PRODUCT}/.infisical.json')); print(d.get('workspaceId',''))" 2>/dev/null || echo "")
    SECRET_PATH=$(python3 -c "import json; d=json.load(open('products/${PRODUCT}/.infisical.json')); print(d.get('secretsPath','/'))" 2>/dev/null || echo "/")
    ENV_SLUG=$(python3 -c "import json; d=json.load(open('products/${PRODUCT}/.infisical.json')); print(d.get('defaultEnvironment','dev'))" 2>/dev/null || echo "dev")
    PROJECT_FLAG=""
    [ -n "$WORKSPACE_ID" ] && PROJECT_FLAG="--projectId=$WORKSPACE_ID"
    echo "🔐 Infisical credentials detected - executing with runtime secrets ($SECRET_PATH)..."
    infisical run $PROJECT_FLAG --path="$SECRET_PATH" --env="$ENV_SLUG" -- docker compose -f "$COMPOSE_FILE" "$@"
  else
    docker compose -f "$COMPOSE_FILE" "$@"
  fi
}

start_stack() {
  echo "======================================"
  echo "🚀 Starting ${PRODUCT} Stack"
  echo "======================================"
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
EOF
  chmod +x "$START_SCRIPT"
  echo -e "  ${GREEN}✔ Created $START_SCRIPT with non-blocking pull-or-run logic${NC}"
else
  echo -e "  ${GREEN}✔ $START_SCRIPT already exists.${NC}"
fi

# 3. GitHub Actions GHCR Workflow
if [ ! -f "$WORKFLOW_FILE" ]; then
  echo -e "${YELLOW}[3/3] Generating $WORKFLOW_FILE...${NC}"
  cat <<EOF > "$WORKFLOW_FILE"
name: Build & Publish ${PRODUCT} Containers to GHCR

on:
  push:
    branches:
      - main
    paths:
      - 'products/${PRODUCT}/**'
      - 'packages/**'
      - 'platform/**'
      - 'pnpm-lock.yaml'
      - 'package.json'
      - '${WORKFLOW_FILE}'
  workflow_dispatch:

permissions:
  contents: read
  packages: write

jobs:
  publish-${PRODUCT}-images:
    name: Build & Push \${{ matrix.service }}
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        include:
          - service: ${PRODUCT}-backend
            context: ./products/${PRODUCT}
            file: ./products/${PRODUCT}/Dockerfile.api
            build-args: ""
          - service: ${PRODUCT}-web
            context: .
            file: ./products/${PRODUCT}/Dockerfile.web
            build-args: ""

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Compute lowercase repository and image tag
        id: meta
        run: |
          REPO_OWNER=\$(echo "\${{ github.repository_owner }}" | tr '[:upper:]' '[:lower:]')
          IMAGE="ghcr.io/\${REPO_OWNER}/\${{ matrix.service }}"
          echo "image=\${IMAGE}" >> "\$GITHUB_OUTPUT"

      - name: Build and push container image
        uses: docker/build-push-action@v6
        with:
          context: \${{ matrix.context }}
          file: \${{ matrix.file }}
          build-args: \${{ matrix.build-args }}
          push: true
          tags: |
            \${{ steps.meta.outputs.image }}:latest
            \${{ steps.meta.outputs.image }}:\${{ github.sha }}
          labels: |
            org.opencontainers.image.source=https://github.com/\${{ github.repository }}
            org.opencontainers.image.description=Pre-built container for \${{ matrix.service }} in Zolexora Platform
          cache-from: type=gha,scope=\${{ matrix.service }}
          cache-to: type=gha,mode=max,scope=\${{ matrix.service }}
EOF
  echo -e "  ${GREEN}✔ Created $WORKFLOW_FILE with GHA caching and Buildx matrix${NC}"
else
  echo -e "  ${GREEN}✔ $WORKFLOW_FILE already exists.${NC}"
fi

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}  ✅ Scaffold Complete for ${PRODUCT}!${NC}"
echo -e "${GREEN}================================================================${NC}"
echo -e "To wire into package.json, add these scripts:"
echo -e "${CYAN}"
cat <<EOF
    "docker:${PRODUCT}:start": "bash products/${PRODUCT}/scripts/docker-start.sh start",
    "docker:${PRODUCT}:stop": "bash products/${PRODUCT}/scripts/docker-start.sh stop",
    "docker:${PRODUCT}:restart": "bash products/${PRODUCT}/scripts/docker-start.sh restart",
    "docker:${PRODUCT}:build": "bash products/${PRODUCT}/scripts/docker-start.sh build",
    "docker:${PRODUCT}:pull": "bash products/${PRODUCT}/scripts/docker-start.sh pull",
    "docker:${PRODUCT}:logs": "bash products/${PRODUCT}/scripts/docker-start.sh logs",
    "docker:${PRODUCT}:status": "bash products/${PRODUCT}/scripts/docker-start.sh status",
EOF
echo -e "${NC}"
