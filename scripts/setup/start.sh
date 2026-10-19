#!/bin/bash
# Zolexora Platform — Universal Startup Script
# Usage: ./scripts/setup/start.sh [product] [action]
set -e

# Always run from repository root
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$REPO_ROOT"

# Colors
GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

echo -e "${BLUE}"
echo "=========================================================="
echo "      🚀  ZOLEXORA PLATFORM  —  STARTUP SCRIPT  🚀      "
echo "=========================================================="
echo -e "${NC}"

# ── 1. Dependency checks ──────────────────────────────────────
echo -e "${YELLOW}[1/4] Checking dependencies...${NC}"
command -v docker >/dev/null 2>&1 || { echo -e "${RED}✘ Docker not found. Install Docker first.${NC}"; exit 1; }
echo -e "  ${GREEN}✔ Docker${NC}"

command -v pnpm >/dev/null 2>&1 || { echo "  pnpm not found — installing..."; npm install -g pnpm; }
echo -e "  ${GREEN}✔ pnpm $(pnpm --version)${NC}"

# ── 2. Infisical detection ────────────────────────────────────
echo -e "\n${YELLOW}[2/4] Secrets Manager...${NC}"
USE_INFISICAL=false
if [ -n "$INFISICAL_TOKEN" ] || [ -n "$INFISICAL_ACCESS_TOKEN" ] || { command -v infisical >/dev/null 2>&1 && infisical login status >/dev/null 2>&1; }; then
  USE_INFISICAL=true
  echo -e "  ${GREEN}✔ Infisical CLI found & authenticated — secrets will be injected automatically.${NC}"
elif command -v infisical >/dev/null 2>&1; then
  echo -e "  ${YELLOW}⚠ Infisical installed but not logged in.${NC}"
  echo -e "    Run: ${BLUE}infisical login${NC} or export INFISICAL_TOKEN to enable automatic secret injection."
  echo -e "    Falling back to local .env files."
else
  echo -e "  ${YELLOW}⚠ Infisical CLI not installed.${NC}"
  echo -e "    Install with: ${BLUE}curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.deb.sh' | sudo bash && sudo apt-get install -y infisical${NC}"
  echo -e "    Falling back to local .env files."
fi

# ── 3. Install workspace dependencies ────────────────────────
echo -e "\n${YELLOW}[3/4] Installing monorepo dependencies...${NC}"
pnpm install --ignore-scripts || true
echo -e "  ${GREEN}✔ Done${NC}"

# ── 4. Product menu or CLI argument ───────────────────────────
echo -e "\n${YELLOW}[4/4] Scanning for Dockerized products...${NC}"
PRODUCTS=(); PATHS=()

PRODUCTS+=("All Products (Root Compose)"); PATHS+=("compose.yaml")

for dir in products/*/ apps/*/; do
  [ -d "$dir" ] || continue
  pname=$(basename "$dir")
  if [ -f "$dir/compose.yaml" ]; then
    PRODUCTS+=("$pname")
    PATHS+=("${dir}compose.yaml")
  elif [ -f "$dir/docker-compose.yml" ]; then
    PRODUCTS+=("$pname")
    PATHS+=("${dir}docker-compose.yml")
  fi
done

CLI_PRODUCT="${1:-}"
CLI_ACTION="${2:-up}"

if [ -n "$CLI_PRODUCT" ]; then
  # CLI argument mode (non-interactive)
  if [ "$CLI_PRODUCT" = "stop" ] || [ "$CLI_PRODUCT" = "down" ]; then
    echo -e "\n${YELLOW}Stopping all containers...${NC}"
    for compose_file in "${PATHS[@]}"; do
      docker compose -f "$compose_file" down 2>/dev/null || true
    done
    echo -e "${GREEN}✔ All containers stopped.${NC}"
    exit 0
  fi

  SELECTED_IDX=-1
  for i in "${!PRODUCTS[@]}"; do
    p="${PRODUCTS[$i]}"
    if [ "$p" = "$CLI_PRODUCT" ] || [[ "$p" == *"$CLI_PRODUCT"* ]] || [ "$(basename "$(dirname "${PATHS[$i]}")")" = "$CLI_PRODUCT" ]; then
      SELECTED_IDX=$i
      break
    fi
  done

  if [ "$SELECTED_IDX" -eq -1 ]; then
    echo -e "${RED}Product '$CLI_PRODUCT' not found. Available products:${NC}"
    for p in "${PRODUCTS[@]}"; do
      echo "  - $p"
    done
    exit 1
  fi
  IDX=$SELECTED_IDX
else
  # Interactive menu mode
  if [ ! -t 0 ]; then
    OPTION=1
  else
    echo -e "\nWhich product would you like to start?\n"
    for i in "${!PRODUCTS[@]}"; do
      printf "  %2d. %s\n" "$((i+1))" "${PRODUCTS[$i]}"
    done
    echo ""
    echo "  $((${#PRODUCTS[@]} + 1)). 🛑  Stop / Down all products"
    echo "  $((${#PRODUCTS[@]} + 2)). ✕   Exit"
    echo ""
    read -rp "Select an option [1-$((${#PRODUCTS[@]} + 2))]: " OPTION
  fi

  # ── Exit / Stop ───────────────────────────────────────────────
  if [ "$OPTION" -eq "$((${#PRODUCTS[@]} + 2))" ]; then
    echo "Exiting."; exit 0
  elif [ "$OPTION" -eq "$((${#PRODUCTS[@]} + 1))" ]; then
    echo -e "\n${YELLOW}Stopping all containers...${NC}"
    for compose_file in "${PATHS[@]}"; do
      docker compose -f "$compose_file" down 2>/dev/null || true
    done
    echo -e "${GREEN}✔ All containers stopped.${NC}"; exit 0
  fi

  if [ "$OPTION" -lt 1 ] || [ "$OPTION" -gt "${#PRODUCTS[@]}" ]; then
    echo -e "${RED}Invalid option.${NC}"; exit 1
  fi

  IDX=$((OPTION - 1))
fi

NAME="${PRODUCTS[$IDX]}"
COMPOSE_FILE="${PATHS[$IDX]}"
DIR=$(dirname "$COMPOSE_FILE")
ACTION="${CLI_ACTION:-up}"

if [ "$ACTION" = "stop" ] || [ "$ACTION" = "down" ]; then
  echo -e "\n${YELLOW}Stopping → $NAME${NC}"
  docker compose -f "$COMPOSE_FILE" down
  echo -e "${GREEN}✔ Stopped $NAME.${NC}"
  exit 0
fi

if [ "$ACTION" = "build" ]; then
  echo -e "\n${YELLOW}Building images for $NAME...${NC}"
  docker compose -f "$COMPOSE_FILE" build
  echo -e "${GREEN}✔ Built images for $NAME.${NC}"
  exit 0
fi

if [ "$ACTION" = "pull" ]; then
  echo -e "\n${YELLOW}Pulling images for $NAME from registry...${NC}"
  docker compose -f "$COMPOSE_FILE" pull
  echo -e "${GREEN}✔ Pulled images for $NAME.${NC}"
  exit 0
fi

if [ "$ACTION" = "ps" ] || [ "$ACTION" = "status" ]; then
  docker compose -f "$COMPOSE_FILE" ps
  exit 0
fi

if [ "$ACTION" = "logs" ]; then
  docker compose -f "$COMPOSE_FILE" logs -f
  exit 0
fi

if [ "$ACTION" = "restart" ]; then
  echo -e "\n${YELLOW}Stopping existing containers for $NAME...${NC}"
  docker compose -f "$COMPOSE_FILE" down
fi

echo -e "\n${GREEN}Starting → $NAME${NC}"

# ── .env fallback ─────────────────────────────────────────────
if [ "$USE_INFISICAL" = false ]; then
  if [ ! -f "$DIR/.env" ]; then
    # Look for .env.example in config/envs/<product>/
    PRODUCT_KEY=$(basename "$DIR")
    EXAMPLE=$(find "config/envs/$PRODUCT_KEY" -name "*.env.example" 2>/dev/null | head -1)
    if [ -n "$EXAMPLE" ]; then
      cp "$EXAMPLE" "$DIR/.env"
      echo -e "  ${YELLOW}⚠ Copied $(basename "$EXAMPLE") → $DIR/.env (fill in real values!)${NC}"
    else
      echo -e "  ${YELLOW}⚠ No .env found for $NAME. Add secrets to config/envs/$PRODUCT_KEY/ or use Infisical.${NC}"
    fi
  fi
fi

# ── Launch Docker Compose ─────────────────────────────────────
echo -e "  ${BLUE}Checking for pre-built images (pulling if missing)...${NC}"
docker compose -f "$COMPOSE_FILE" pull --ignore-pull-failures 2>/dev/null || true

if [ "$USE_INFISICAL" = true ] && [ -f "$DIR/.infisical.json" ]; then
  WORKSPACE_ID=$(python3 -c "import json; d=json.load(open('$DIR/.infisical.json')); print(d.get('workspaceId',''))" 2>/dev/null || echo "")
  SECRET_PATH=$(python3 -c "import json; d=json.load(open('$DIR/.infisical.json')); print(d.get('secretsPath','/'))" 2>/dev/null || echo "/")
  ENV_SLUG=$(python3 -c "import json; d=json.load(open('$DIR/.infisical.json')); print(d.get('defaultEnvironment','dev'))" 2>/dev/null || echo "dev")
  PROJECT_FLAG=""
  if [ -n "$WORKSPACE_ID" ]; then
    PROJECT_FLAG="--projectId=$WORKSPACE_ID"
  fi
  echo -e "  ${BLUE}Injecting secrets from Infisical path: $SECRET_PATH (env: $ENV_SLUG, project: ${WORKSPACE_ID:-default})${NC}"
  infisical run $PROJECT_FLAG --path="$SECRET_PATH" --env="$ENV_SLUG" -- \
    docker compose -f "$COMPOSE_FILE" up -d
else
  docker compose -f "$COMPOSE_FILE" up -d
fi

echo -e "\n=========================================================="
echo -e "${GREEN}✅  $NAME is now running!${NC}"
echo -e "  Logs : ${BLUE}docker compose -f $COMPOSE_FILE logs -f${NC}"
echo -e "  Stop : ${BLUE}docker compose -f $COMPOSE_FILE down${NC}"
echo -e "=========================================================="
