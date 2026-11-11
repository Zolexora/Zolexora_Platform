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
      if grep -qE "^\s*build:" "$COMPOSE_FILE" 2>/dev/null; then
        HAS_SCRIPT="${YELLOW}⚠ Local build in compose${NC}"
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
WORKFLOW_FILE=".github/workflows/${PRODUCT}-docker.yml"
SLUG="${PRODUCT#zolexora-}"
VAR="$(echo "${SLUG^^}" | tr '-' '_')"

echo -e "\n${BLUE}================================================================${NC}"
echo -e "${BLUE}  🚀 Scaffolding Docker & GHCR Setup for: ${GREEN}${PRODUCT}${NC}"
echo -e "${BLUE}================================================================${NC}\n"

# 1. Compose YAML
if [ ! -f "$COMPOSE_FILE" ]; then
  echo -e "${YELLOW}[1/3] Generating $COMPOSE_FILE...${NC}"
  cat <<EOF > "$COMPOSE_FILE"
services:
  backend:
    image: \${${VAR}_BACKEND_IMAGE:-ghcr.io/zolexora/zolexora-${SLUG}-backend:latest}
    pull_policy: missing
    container_name: ${PRODUCT}-backend
    ports:
      - "\${${VAR}_BACKEND_PORT:-4040}:4030"
    restart: unless-stopped

  web:
    image: \${${VAR}_WEB_IMAGE:-ghcr.io/zolexora/zolexora-${SLUG}-web:latest}
    pull_policy: missing
    container_name: ${PRODUCT}-web
    ports:
      - "\${${VAR}_PORT:-3095}:80"
    restart: unless-stopped
EOF
  echo -e "  ${GREEN}✔ Created $COMPOSE_FILE with GHCR images only (built in GitHub CI, never locally)${NC}"
else
  echo -e "  ${GREEN}✔ $COMPOSE_FILE already exists.${NC}"
fi

# 1b. Infisical link (the only secret source)
if [ ! -f "products/${PRODUCT}/.infisical.json" ]; then
  printf '{\n  "workspaceId": "c4ac7d07-f26f-4fb8-bd04-6d3e037079f9",\n  "defaultEnvironment": "dev",\n  "secretsPath": "/%s"\n}\n' "$PRODUCT" > "products/${PRODUCT}/.infisical.json"
  echo -e "  ${GREEN}✔ Created products/${PRODUCT}/.infisical.json — set secretsPath to its Infisical folder (e.g. /Zolexora_TMS).${NC}"
fi

# 2. docker-start.sh
if [ ! -f "$START_SCRIPT" ]; then
  echo -e "${YELLOW}[2/3] Generating $START_SCRIPT...${NC}"
  cat <<'EOF' > "$START_SCRIPT"
#!/bin/bash
# {start|stop|restart|pull|status|logs} [services...] — runs this stack from GHCR images built in CI.
exec bash "$(dirname "$0")/../../../scripts/docker/product-stack.sh" "$(dirname "$0")/.." "$@"
EOF
  chmod +x "$START_SCRIPT"
  echo -e "  ${GREEN}✔ Created $START_SCRIPT (wraps scripts/docker/product-stack.sh)${NC}"
else
  echo -e "  ${GREEN}✔ $START_SCRIPT already exists.${NC}"
fi

# 3. GitHub Actions GHCR Workflow
if [ ! -f "$WORKFLOW_FILE" ]; then
  echo -e "${YELLOW}[3/3] Generating $WORKFLOW_FILE...${NC}"
  cat <<EOF > "$WORKFLOW_FILE"
name: ${PRODUCT} — Docker images

on:
  push:
    branches: [main]
    paths:
      - 'products/${PRODUCT}/**'
      - 'packages/**'
      - 'pnpm-lock.yaml'
      - '${WORKFLOW_FILE}'
  workflow_dispatch:

permissions:
  contents: read
  packages: write

jobs:
  images:
    uses: ./.github/workflows/reusable-docker-ghcr.yml
    with:
      product: ${SLUG}
      services: |
        [
          {"service": "backend", "file": "products/${PRODUCT}/Dockerfile.api"},
          {"service": "web", "file": "products/${PRODUCT}/Dockerfile.web"}
        ]
EOF
  echo -e "  ${GREEN}✔ Created $WORKFLOW_FILE using reusable-docker-ghcr.yml${NC}"
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
    "docker:${PRODUCT}:pull": "bash products/${PRODUCT}/scripts/docker-start.sh pull",
    "docker:${PRODUCT}:logs": "bash products/${PRODUCT}/scripts/docker-start.sh logs",
    "docker:${PRODUCT}:status": "bash products/${PRODUCT}/scripts/docker-start.sh status",
EOF
echo -e "${NC}"
