#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(git -C "$script_dir" rev-parse --show-toplevel)

if [[ $# -ne 0 ]]; then
  printf 'ERROR: tests/run.sh accepts no target or arguments\n' >&2
  exit 64
fi

tests=(
  tests/contract/repository-structure.sh
  tests/contract/application-deployment-contract.sh
  tests/contract/library-contract.sh
  tests/contract/doctor-contract.sh
  tests/unit/runtime-test.sh
  tests/unit/validation-test.sh
  tests/unit/paths-test.sh
  tests/unit/config-test.sh
  tests/unit/locking-test.sh
  tests/unit/release-test.sh
  tests/unit/diagnostics-test.sh
  tests/contract/install-plan-contract.sh
  tests/unit/installation-test.sh
  tests/contract/installer-execution-contract.sh
  tests/unit/installer-execution-test.sh
  tests/integration/isolated-installer-test.sh
)

cd -- "$repo_root"
for test_file in "${tests[@]}"; do
  printf 'RUN: %s\n' "$test_file"
  if ! "$test_file"; then
    printf 'FAIL: %s\n' "$test_file" >&2
    exit 1
  fi
done

printf 'PASS: all DP-07 non-container tests\n'
