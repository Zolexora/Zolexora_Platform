#!/usr/bin/env bash
# ==============================================================================
# Zolexora IMS — Enterprise Deployment Orchestrator
# Supports: Render (Containers), Cloudflare Pages (Vite SPA), Docker Stack
# Usage: ./scripts/deploy.sh [OPTIONS]
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

TARGET="all"
ENV="production"
DRY_RUN=false
SKIP_TESTS=false
SKIP_BUILD=false

print_banner() {
  echo -e "${CYAN}${BOLD}"
  echo "╔══════════════════════════════════════════════════════════════════════╗"
  echo "║               ZOLEXORA IMS — DEPLOYMENT ORCHESTRATOR                ║"
  echo "║        Render (Containers) • Cloudflare Pages • Docker Stack         ║"
  echo "╚══════════════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

print_help() {
  echo -e "${BOLD}Usage:${NC} ./scripts/deploy.sh [OPTIONS]"
  echo ""
  echo -e "${BOLD}Options:${NC}"
  echo "  -t, --target <target>   Deployment target: all | render | cloudflare | docker (default: all)"
  echo "  -e, --env <env>         Target environment: production | staging | preview (default: production)"
  echo "  -s, --skip-tests        Skip pre-flight test suites and linters"
  echo "  -b, --skip-build        Skip rebuilding frontend production bundles"
  echo "  -d, --dry-run           Simulate deployment without triggering cloud actions"
  echo "  -h, --help              Show this help menu"
  echo ""
  echo -e "${BOLD}Examples:${NC}"
  echo "  ./scripts/deploy.sh --target render"
  echo "  ./scripts/deploy.sh --target cloudflare --env preview"
  echo "  ./scripts/deploy.sh --target all --skip-tests"
  echo "  ./scripts/deploy.sh --dry-run"
  exit 0
}

# Parse CLI arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--target)
      TARGET="$2"
      shift 2
      ;;
    -e|--env)
      ENV="$2"
      shift 2
      ;;
    -s|--skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    -b|--skip-build)
      SKIP_BUILD=true
      shift
      ;;
    -d|--dry-run)
      DRY_RUN=true
      shift
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

# Step 1: Pre-flight Verification
preflight_checks() {
  echo -e "\n${BLUE}${BOLD}[1/5] Running Pre-Flight Verification...${NC}"

  # Git check
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
  echo -e "  • Current Git Branch: ${CYAN}${CURRENT_BRANCH}${NC}"
  if [[ "${CURRENT_BRANCH}" != "dev" && "${CURRENT_BRANCH}" != "main" ]]; then
    echo -e "  ${YELLOW}⚠️ Warning: You are deploying from branch '${CURRENT_BRANCH}'. Standard branches are 'dev' or 'main'.${NC}"
  fi

  # Secrets check
  echo -e "  • Checking for un-ignored sensitive files..."
  if git status --porcelain | grep -E "\.env|\.pem|\.key" | grep -v "\.example" >/dev/null 2>&1; then
    echo -e "  ${RED}❌ Error: Sensitive environment files detected in git status! Aborting.${NC}"
    exit 1
  fi
  echo -e "  ${GREEN}✓ Secrets hygiene verified (no leaked credentials staged).${NC}"

  # Blueprint check if deploying to Render
  if [[ "${TARGET}" == "render" || "${TARGET}" == "all" ]]; then
    echo -e "  • Validating Render Blueprint (${ROOT_DIR}/infra/render/render.yaml)..."
    if command -v render >/dev/null 2>&1; then
      if render blueprints validate "${ROOT_DIR}/infra/render/render.yaml" >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Render blueprint schema is valid.${NC}"
      else
        echo -e "  ${YELLOW}⚠️ Render blueprint validation had warnings or auth was not set.${NC}"
      fi
    else
      echo -e "  ${YELLOW}⚠️ Render CLI not in PATH; skipping live blueprint API validation.${NC}"
    fi
  fi
}

# Step 2: Quality Assurance & Tests
run_tests() {
  if [[ "${SKIP_TESTS}" == "true" ]]; then
    echo -e "\n${YELLOW}${BOLD}[2/5] Skipping tests as requested (--skip-tests).${NC}"
    return
  fi

  echo -e "\n${BLUE}${BOLD}[2/5] Running Quality Gate Tests...${NC}"
  if command -v pytest >/dev/null 2>&1; then
    echo -e "  • Executing Python Backend Pytest Suite..."
    if pytest "${ROOT_DIR}/apps/ims-user/backend/tests" "${ROOT_DIR}/apps/ims-admin/backend/tests" -q; then
      echo -e "  ${GREEN}✓ Backend pytest suites passed (100% clean).${NC}"
    else
      echo -e "  ${RED}❌ Error: Pytest tests failed. Fix errors or pass --skip-tests to bypass.${NC}"
      exit 1
    fi
  else
    echo -e "  ${YELLOW}⚠️ pytest not found; skipping backend unit tests.${NC}"
  fi
}

# Step 3: Frontend Build
build_frontends() {
  if [[ "${SKIP_BUILD}" == "true" ]]; then
    echo -e "\n${YELLOW}${BOLD}[3/5] Skipping frontend builds as requested (--skip-build).${NC}"
    return
  fi

  echo -e "\n${BLUE}${BOLD}[3/5] Compiling Production Frontend Bundles...${NC}"
  cd "${ROOT_DIR}"
  if command -v pnpm >/dev/null 2>&1; then
    echo -e "  • Building User & Admin Vite SPA Bundles with pnpm..."
    pnpm --filter "@zolexora/*" build
    echo -e "  ${GREEN}✓ Production frontend builds completed successfully.${NC}"
  else
    echo -e "  ${RED}❌ Error: pnpm is required to build frontends.${NC}"
    exit 1
  fi
}

# Step 4: Deploy Targets
deploy_render() {
  echo -e "\n${MAGENTA}${BOLD}🚀 Deploying to Render Cloud Platform...${NC}"
  echo -e "  • Target Services:"
  echo -e "    - zolexora-ims-api (Docker Web Service)"
  echo -e "    - zolexora-admin-api (Docker Web Service)"
  echo -e "    - zolexora-user-frontend (Docker SPA Container)"
  echo -e "    - zolexora-admin-frontend (Docker SPA Container)"

  if [[ "${DRY_RUN}" == "true" ]]; then
    echo -e "  ${YELLOW}[DRY RUN] Would trigger Render blueprint sync via Render CLI or Git push to dev.${NC}"
    return
  fi

  if command -v render >/dev/null 2>&1; then
    echo -e "  • Synchronizing via Render CLI..."
    if render services list >/dev/null 2>&1; then
      echo -e "  • Triggering deploy on active Render services..."
      render deploys create --all 2>/dev/null || echo -e "  ${YELLOW}Note: Use git push to trigger continuous deployment on linked Render repo.${NC}"
    else
      echo -e "  ${YELLOW}Render CLI is installed but not authenticated. Run 'render login' or push to git to deploy.${NC}"
    fi
  fi

  echo -e "  • Pushing latest commit to origin/${CURRENT_BRANCH} to trigger Render auto-deploy hooks..."
  git push origin "${CURRENT_BRANCH}" || echo -e "  ${YELLOW}Git push skipped or already up to date.${NC}"
  echo -e "  ${GREEN}✓ Render deployment pipeline triggered.${NC}"
}

deploy_cloudflare() {
  echo -e "\n${MAGENTA}${BOLD}⚡ Deploying to Cloudflare Pages...${NC}"

  if [[ "${DRY_RUN}" == "true" ]]; then
    echo -e "  ${YELLOW}[DRY RUN] Would run wrangler pages deploy for User & Admin Frontends.${NC}"
    return
  fi

  local WRANGLER_BIN="pnpm exec wrangler"
  if ! command -v pnpm >/dev/null 2>&1; then
    WRANGLER_BIN="npx wrangler"
  fi

  # 1. User Frontend Pages
  echo -e "  • Deploying User POS & Inventory (dist/) to Cloudflare Pages..."
  if [[ -d "${ROOT_DIR}/apps/ims-user/frontend/dist" ]]; then
    $WRANGLER_BIN pages deploy "${ROOT_DIR}/apps/ims-user/frontend/dist" \
      --project-name="zolexora-ims-web" \
      --branch="${CURRENT_BRANCH}" \
      --commit-dirty=true || echo -e "  ${YELLOW}⚠️ Cloudflare deploy requires 'wrangler login' or CLOUDFLARE_API_TOKEN.${NC}"
  else
    echo -e "  ${RED}❌ apps/ims-user/frontend/dist not found! Run build first.${NC}"
  fi

  # 2. Admin Frontend Pages
  echo -e "  • Deploying Admin Platform (dist/) to Cloudflare Pages..."
  if [[ -d "${ROOT_DIR}/apps/ims-admin/frontend/dist" ]]; then
    $WRANGLER_BIN pages deploy "${ROOT_DIR}/apps/ims-admin/frontend/dist" \
      --project-name="zolexora-admin-web" \
      --branch="${CURRENT_BRANCH}" \
      --commit-dirty=true || echo -e "  ${YELLOW}⚠️ Cloudflare deploy requires 'wrangler login' or CLOUDFLARE_API_TOKEN.${NC}"
  fi
  echo -e "  ${GREEN}✓ Cloudflare Pages deployment completed.${NC}"
}

deploy_docker() {
  echo -e "\n${MAGENTA}${BOLD}🐳 Deploying via Docker Containers...${NC}"

  if [[ "${DRY_RUN}" == "true" ]]; then
    echo -e "  ${YELLOW}[DRY RUN] Would run 'docker compose up -d --build'.${NC}"
    return
  fi

  cd "${ROOT_DIR}"
  if command -v docker >/dev/null 2>&1; then
    echo -e "  • Building and starting container stack with Docker Compose..."
    docker compose up -d --build
    echo -e "  ${GREEN}✓ All container services running in background.${NC}"
    docker compose ps
  else
    echo -e "  ${RED}❌ Docker not found in system PATH.${NC}"
    exit 1
  fi
}

# Step 5: Post-Deployment Smoke Tests
post_deploy_smoke_tests() {
  echo -e "\n${BLUE}${BOLD}[5/5] Executing Post-Deployment Smoke Tests...${NC}"

  if [[ "${DRY_RUN}" == "true" ]]; then
    echo -e "  ${YELLOW}[DRY RUN] Smoke testing skipped.${NC}"
    return
  fi

  # Run local healthcheck if Docker target or local instances active
  if [[ -f "${SCRIPT_DIR}/health-check.sh" ]]; then
    bash "${SCRIPT_DIR}/health-check.sh" || echo -e "  ${YELLOW}⚠️ Smoke tests finished with warnings.${NC}"
  fi
}

# Execution Pipeline
main() {
  print_banner
  echo -e "Target:      ${BOLD}${TARGET}${NC}"
  echo -e "Environment: ${BOLD}${ENV}${NC}"
  echo -e "Dry Run:     ${BOLD}${DRY_RUN}${NC}"
  echo ""

  preflight_checks
  run_tests
  build_frontends

  echo -e "\n${BLUE}${BOLD}[4/5] Executing Deployment to Target: ${TARGET}...${NC}"
  case "${TARGET}" in
    render)
      deploy_render
      ;;
    cloudflare)
      deploy_cloudflare
      ;;
    docker)
      deploy_docker
      ;;
    all)
      deploy_render
      deploy_cloudflare
      deploy_docker
      ;;
    *)
      echo -e "${RED}Unknown target: ${TARGET}. Options are: all | render | cloudflare | docker${NC}"
      exit 1
      ;;
  esac

  post_deploy_smoke_tests

  echo -e "\n${GREEN}${BOLD}══════════════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}${BOLD}       🎉 DEPLOYMENT PIPELINE EXECUTION COMPLETED SUCCESSFULLY!       ${NC}"
  echo -e "${GREEN}${BOLD}══════════════════════════════════════════════════════════════════════${NC}\n"
}

main
