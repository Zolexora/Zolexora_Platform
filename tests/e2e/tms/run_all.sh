#!/usr/bin/env bash
# ==============================================================================
# Zolexora TMS — 4-Tier Automated E2E Test Suite Runner
# Usage: ./tests/e2e/tms/run_all.sh [OPTIONS]
# Options:
#   --tier <1|2|3|4>    Execute only tests in the specified tier
#   -v, --verbose       Enable verbose test case output
#   --json              Produce machine-readable JSON output for CI/CD
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

export PYTHONPATH="${SCRIPT_DIR}:${PYTHONPATH:-}"

python3 "${SCRIPT_DIR}/run_all.py" "$@"
