#!/usr/bin/env bash
# ==============================================================================
# Zolexora Auth Service & Client SDK — 4-Tier Automated E2E Test Suite Runner
# Usage: ./tests/e2e/auth-service/run_all.sh [OPTIONS]
# Options:
#   --tier <1|2|3|4>    Execute only tests in the specified tier
#   -v, --verbose       Enable verbose test case output
#   --json              Produce machine-readable JSON output for CI/CD
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

cd "${REPO_ROOT}"

VITEST_BIN="${REPO_ROOT}/node_modules/.bin/vitest"
CONFIG_FILE="${SCRIPT_DIR}/vitest.config.ts"

TIER_ARG=""
VERBOSE=false
JSON_OUTPUT=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tier)
      TIER_ARG="$2"
      shift 2
      ;;
    -v|--verbose)
      VERBOSE=true
      shift
      ;;
    --json)
      JSON_OUTPUT=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--tier <1|2|3|4>] [-v|--verbose] [--json]"
      exit 1
      ;;
  esac
done

TARGET_PATHS=()

if [[ -z "${TIER_ARG}" ]]; then
  TARGET_PATHS=(
    "${SCRIPT_DIR}/tier1-features"
    "${SCRIPT_DIR}/tier2-boundaries"
    "${SCRIPT_DIR}/tier3-combinations"
    "${SCRIPT_DIR}/tier4-workloads"
  )
elif [[ "${TIER_ARG}" == "1" ]]; then
  TARGET_PATHS=("${SCRIPT_DIR}/tier1-features")
elif [[ "${TIER_ARG}" == "2" ]]; then
  TARGET_PATHS=("${SCRIPT_DIR}/tier2-boundaries")
elif [[ "${TIER_ARG}" == "3" ]]; then
  TARGET_PATHS=("${SCRIPT_DIR}/tier3-combinations")
elif [[ "${TIER_ARG}" == "4" ]]; then
  TARGET_PATHS=("${SCRIPT_DIR}/tier4-workloads")
else
  echo "Error: Invalid tier '${TIER_ARG}'. Must be 1, 2, 3, or 4."
  exit 1
fi

VITEST_FLAGS=(run --config "${CONFIG_FILE}")

if [[ "${VERBOSE}" == "true" ]]; then
  VITEST_FLAGS+=(--reporter=verbose)
fi

if [[ "${JSON_OUTPUT}" == "true" ]]; then
  VITEST_FLAGS+=(--reporter=json)
fi

echo "================================================================================"
echo "          ZOLEXORA AUTH SERVICE & CLIENT SDK — E2E TEST RUNNER                  "
echo "================================================================================"
echo "Target Scope : ${TARGET_PATHS[*]}"
echo "Config Path  : ${CONFIG_FILE}"
echo "--------------------------------------------------------------------------------"

"${VITEST_BIN}" "${VITEST_FLAGS[@]}" "${TARGET_PATHS[@]}"
