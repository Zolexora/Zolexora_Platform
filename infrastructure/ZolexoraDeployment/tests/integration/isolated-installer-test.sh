#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(cd -- "$script_dir/../.." && pwd -P)
# shellcheck source=../lib/test-helpers.sh
source "$repo_root/tests/lib/test-helpers.sh"
for library in runtime validation paths diagnostics installation installer-execution; do
  # shellcheck disable=SC1090
  source "$repo_root/core/lib/$library.sh"
done

fixture_dir=$repo_root/tests/fixtures/install/execution
host_data_before=$(stat -c '%F:%a:%Y:%Z' -- /data 2>/dev/null || printf absent)
declare -a roots=()
new_root() {
  local output_name=$1 test_root
  dp_test_make_isolation_root test_root
  roots+=("$test_root")
  printf -v "$output_name" '%s' "$test_root"
}
cleanup() {
  local root
  for root in "${roots[@]}"; do [[ ! -d $root ]] || dp_test_cleanup_temp_dir "$root"; done
}
trap cleanup EXIT

declare -A plan=() layout=() report=() detected=() recovery=()
dp_exec_read_plan "$fixture_dir/valid-execution-plan.tsv" plan
dp_install_read_filesystem_manifest "$repo_root/core/install/filesystem-layout.tsv" layout

root=
new_root root
cp -- "$fixture_dir/missing-package-state.tsv" "$root/package-input.tsv"
dp__exec_execute_isolated "$root" plan layout report
dp_test_assert_eq pass "${report[overall_status]}" 'first isolated execution'
dp_test_assert_eq complete "${report[transaction_state]}" 'first transaction completion'
dp_test_assert_eq 6 "$(find "$root/data" -mindepth 1 -maxdepth 1 -type d | wc -l)" 'six-child layout'
for child in projects backups logs secrets ssl scripts; do [[ -d $root/data/$child && ! -L $root/data/$child ]] || dp_test_fail "missing isolated child: $child"; done
for path_mode in 'data 755' 'data/projects 750' 'data/backups 750' 'data/logs 750' 'data/secrets 700' 'data/ssl 700' 'data/scripts 755'; do
  read -r relative expected_mode <<< "$path_mode"
  dp_test_assert_eq "$expected_mode" "$(stat -c '%a' "$root/$relative")" "isolated mode: $relative"
done
first_report=$(dp_exec_render_json report)
dp__exec_execute_isolated "$root" plan layout report
dp_test_assert_eq unchanged "${report[apply_package_state.status]}" 'package-state re-execution'
dp_test_assert_eq unchanged "${report[apply_filesystem_layout.status]}" 'filesystem re-execution'
dp_exec_detect_partial_install "$root" plan detected
dp_test_assert_eq complete "${detected[DETECTED_STATE]}" 'completed-state detection'

for point in "${DP_EXEC_FAILURE_POINTS[@]}"; do
  failure_root=
  new_root failure_root
  cp -- "$fixture_dir/complete-package-state.tsv" "$failure_root/package-input.tsv"
  printf '%s\n' "$point" > "$failure_root/failure-point"
  chmod 0600 -- "$failure_root/failure-point"
  dp__exec_execute_isolated "$failure_root" plan layout report
  dp_test_assert_eq critical "${report[overall_status]}" "failure injection: $point"
  dp_exec_detect_partial_install "$failure_root" plan detected
  dp_exec_build_recovery_plan "$failure_root" plan recovery
  if [[ $point == before_initialize_transaction ]]; then
    dp_test_assert_eq no_previous_transaction "${detected[DETECTED_STATE]}" 'failure before mutation'
  else
    dp_test_assert_eq true "${detected[MANUAL_REVIEW_REQUIRED]}" "partial detection: $point"
    dp_test_assert_eq true "${recovery[manual_review_required]}" "recovery review: $point"
  fi
done

host_data_after=$(stat -c '%F:%a:%Y:%Z' -- /data 2>/dev/null || printf absent)
dp_test_assert_eq "$host_data_before" "$host_data_after" 'host /data metadata changed'
dp_test_assert_not_contains "$first_report" "$root" 'report exposed isolation root'
dp_test_finish 'isolated installer integration tests'
