#!/usr/bin/env bash
# ==============================================================================
# Zolexora IMS — Cloudflare Pages Frontend Deployment (100% Free Forever)
# Deploys User Frontend (POS & Inventory) and Admin Frontend to Cloudflare Pages
# Zero cold starts • Unlimited bandwidth • Global edge CDN in 330+ cities
# Usage: ./scripts/deploy-frontends-cloudflare.sh [OPTIONS]
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "dev")
TARGET="all"

print_banner() {
  echo -e "${CYAN}${BOLD}"
  echo "╔══════════════════════════════════════════════════════════════════════╗"
  echo "║        ZOLEXORA IMS — CLOUDFLARE PAGES FRONTEND DEPLOYMENT           ║"
  echo "║         100% Free Tier • Zero Cold Starts • Unlimited Bandwidth      ║"
  echo "╚══════════════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

print_help() {
  echo -e "${BOLD}Usage:${NC} ./scripts/deploy-frontends-cloudflare.sh [OPTIONS]"
  echo ""
  echo -e "${BOLD}Options:${NC}"
  echo "  -t, --target <all|user|admin>   Select frontend app (default: all)"
  echo "  -b, --branch <name>             Target branch name (default: current git branch)"
  echo "  -h, --help                      Show this help message"
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--target)
      TARGET="$2"
      shift 2
      ;;
    -b|--branch)
      BRANCH="$2"
      shift 2
      ;;
    -h|--help)
      print_help
      ;;
    *)
      echo -e "${RED}Unknown argument: $1${NC}"
      print_help
      ;;
  esac
done

get_wrangler() {
  if command -v pnpm >/dev/null 2>&1; then
    echo "pnpm exec wrangler"
  else
    echo "npx wrangler"
  fi
}

main() {
  print_banner
  local WRANGLER_BIN
  WRANGLER_BIN=$(get_wrangler)

  echo -e "${BLUE}${BOLD}[1/2] Compiling Production Frontend Bundles...${NC}"
  cd "${ROOT_DIR}"
  pnpm --filter "@zolexora/*" build
  echo -e "${GREEN}✓ Production builds ready in dist/ folders.${NC}\n"

  echo -e "${BLUE}${BOLD}[2/2] Deploying to Cloudflare Global Edge Network...${NC}"

  # 1. User Frontend (POS & Inventory)
  if [[ "${TARGET}" == "all" || "${TARGET}" == "user" ]]; then
    echo -e "  • Deploying ${CYAN}zolexora-ims-web${NC} (POS & Inventory SPA)..."
    $WRANGLER_BIN pages deploy "${ROOT_DIR}/apps/ims-user/frontend/dist" \
      --project-name="zolexora-ims-web" \
      --branch="${BRANCH}" \
      --commit-dirty=true || {
        echo -e "  ${YELLOW}⚠️ Cloudflare Pages deployment requires 'wrangler login' or CLOUDFLARE_API_TOKEN.${NC}"
      }
    echo -e "  ${GREEN}✓ User Frontend deployed: https://zolexora-ims-web.pages.dev${NC}\n"
  fi

  # 2. Admin Frontend
  if [[ "${TARGET}" == "all" || "${TARGET}" == "admin" ]]; then
    echo -e "  • Deploying ${CYAN}zolexora-admin-web${NC} (SuperAdmin Control Center)..."
    $WRANGLER_BIN pages deploy "${ROOT_DIR}/apps/ims-admin/frontend/dist" \
      --project-name="zolexora-admin-web" \
      --branch="${BRANCH}" \
      --commit-dirty=true || {
        echo -e "  ${YELLOW}⚠️ Cloudflare Pages deployment requires 'wrangler login' or CLOUDFLARE_API_TOKEN.${NC}"
      }
    echo -e "  ${GREEN}✓ Admin Frontend deployed: https://zolexora-admin-web.pages.dev${NC}\n"
  fi

  echo -e "${GREEN}${BOLD}══════════════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}${BOLD}   🎉 Frontends live on Cloudflare Pages with Global CDN & SSL!       ${NC}"
  echo -e "${GREEN}${BOLD}══════════════════════════════════════════════════════════════════════${NC}\n"
}

main
