#!/usr/bin/env bash
# ==============================================================================
# Zolexora IMS — Full-Stack Quality Gate & CI/CD Test Runner
# Executes backend tests, TypeScript checks, security audits, and bundle builds
# Usage: ./scripts/test-all.sh [OPTIONS]
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASSED_COUNT=0
FAILED_COUNT=0
TOTAL_START=$(date +%s)

print_banner() {
  echo -e "${CYAN}${BOLD}"
  echo "╔══════════════════════════════════════════════════════════════════════╗"
  echo "║          ZOLEXORA IMS — PRODUCTION QUALITY GATE RUNNER               ║"
  echo "║      Backend Pytest • TypeScript • Security • Production Build       ║"
  echo "╚══════════════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

run_step() {
  local title="$1"
  local cmd="$2"
  echo -e "\n${BLUE}${BOLD}▶ ${title}...${NC}"
  local step_start
  step_start=$(date +%s)

  if eval "${cmd}"; then
    local step_end
    step_end=$(date +%s)
    local step_dur=$((step_end - step_start))
    echo -e "  ${GREEN}✓ PASSED${NC} (${step_dur}s)"
    PASSED_COUNT=$((PASSED_COUNT + 1))
  else
    local step_end
    step_end=$(date +%s)
    local step_dur=$((step_end - step_start))
    echo -e "  ${RED}✕ FAILED${NC} (${step_dur}s)"
    FAILED_COUNT=$((FAILED_COUNT + 1))
  fi
}

main() {
  print_banner

  # 1. Python Code Syntax & Integrity
  run_step "Checking Python Syntax across User & Admin Backends" \
    "python3 -m py_compile \
      ${ROOT_DIR}/apps/ims-user/backend/*.py \
      ${ROOT_DIR}/apps/ims-admin/backend/*.py"

  # 2. Pytest Suite
  run_step "Running FastAPI Backend Pytest Suites" \
    "pytest ${ROOT_DIR}/apps/ims-user/backend/tests ${ROOT_DIR}/apps/ims-admin/backend/tests -v"

  # 3. TypeScript Typecheck
  run_step "Running TypeScript Verification (User Frontend)" \
    "cd ${ROOT_DIR}/apps/ims-user/frontend && pnpm exec tsc --noEmit"

  run_step "Running TypeScript Verification (Admin Frontend)" \
    "cd ${ROOT_DIR}/apps/ims-admin/frontend && pnpm exec tsc --noEmit"

  # 4. Security & Secret Leak Scanning
  run_step "Auditing Working Tree for Unprotected Secrets" \
    "! git status --porcelain | grep -E '\.env|\.pem|\.key' | grep -v '\.example'"

  # 5. Render Blueprint Validation
  run_step "Validating Infrastructure as Code (render.yaml)" \
    "render blueprints validate ${ROOT_DIR}/infra/render/render.yaml"

  # 6. Production Frontend Build Compilation
  run_step "Compiling Monorepo Frontend Production Bundles" \
    "cd ${ROOT_DIR} && pnpm --filter '@zolexora/*' build"

  # Final Summary Report
  local TOTAL_END
  TOTAL_END=$(date +%s)
  local TOTAL_DUR=$((TOTAL_END - TOTAL_START))

  echo -e "\n${CYAN}${BOLD}══════════════════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}                     QUALITY GATE SUMMARY REPORT                      ${NC}"
  echo -e "${CYAN}${BOLD}══════════════════════════════════════════════════════════════════════${NC}"
  echo -e "Total Time:       ${BOLD}${TOTAL_DUR}s${NC}"
  echo -e "Passed Checks:    ${GREEN}${BOLD}${PASSED_COUNT}${NC}"
  echo -e "Failed Checks:    ${RED}${BOLD}${FAILED_COUNT}${NC}"

  if [[ "${FAILED_COUNT}" -eq 0 ]]; then
    echo -e "\n${GREEN}${BOLD}🎉 ALL QUALITY GATES PASSED! Code is 100% production ready.${NC}\n"
    exit 0
  else
    echo -e "\n${RED}${BOLD}❌ QUALITY GATE FAILED! Review errors above before pushing.${NC}\n"
    exit 1
  fi
}

main "$@"
