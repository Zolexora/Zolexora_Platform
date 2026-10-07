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
declare -a isolation_roots=()
dp_test_new_exec_root() {
  local output_name=$1 test_root
  dp_test_make_isolation_root test_root
  isolation_roots+=("$test_root")
  printf -v "$output_name" '%s' "$test_root"
}
dp_test_cleanup_exec_roots() {
  local root
  for root in "${isolation_roots[@]}"; do [[ ! -d $root ]] || dp_test_cleanup_temp_dir "$root"; done
}
trap dp_test_cleanup_exec_roots EXIT

source_root=
dp_test_new_exec_root source_root
source_marker=$source_root/source-command-marker
source_bin=$source_root/bin
mkdir -- "$source_bin"
for command_name in realpath stat sha256sum mkdir chmod mv find rm apt apt-get systemctl docker curl wget; do
  printf '#!/usr/bin/env bash\nprintf invoked > "%s"\nexit 99\n' "$source_marker" > "$source_bin/$command_name"
  chmod 0755 -- "$source_bin/$command_name"
done
source_output=$(cd -- "$source_root" && PATH=$source_bin /bin/bash -c 'unset DP_INSTALLER_EXECUTION_SH_LOADED; source "$1"; source "$1"' -- "$repo_root/core/lib/installer-execution.sh" 2>&1)
dp_test_assert_eq '' "$source_output" 'installer-execution source-time silence'
[[ ! -e $source_marker ]] || dp_test_fail 'installer-execution source performed inspection or mutation'

root=
dp_test_new_exec_root root
declare -A isolation=()
dp_exec_validate_isolation_root "$root" isolation
dp_test_assert_eq pass "${isolation[STATUS]}" 'valid isolation root rejected'

marker=$root/$DP_EXEC_ISOLATION_MARKER_NAME
unlink -- "$marker"
dp_exec_validate_isolation_root "$root" isolation
dp_test_assert_eq critical "${isolation[STATUS]}" 'missing marker accepted'
printf 'incorrect-marker\n' > "$marker"
chmod 0600 -- "$marker"
dp_exec_validate_isolation_root "$root" isolation
dp_test_assert_eq critical "${isolation[STATUS]}" 'incorrect marker accepted'
printf '%s\n' "$DP_EXEC_ISOLATION_MARKER_VALUE" > "$marker"

for rejected in / /data /tmp "$repo_root" "${repo_root%/*}" "$PWD" "${HOME:-/nonexistent-home}" relative/path '/tmp/zolexora-dp07.bad/../escape' '/tmp/zolexora-dp07.bad;unsafe'; do
  dp_exec_validate_isolation_root "$rejected" isolation
  dp_test_assert_eq critical "${isolation[STATUS]}" 'unsafe isolation root accepted'
done
symlink_root=/tmp/zolexora-dp07.SYMLNK
ln -s -- "$root" "$symlink_root"
dp_exec_validate_isolation_root "$symlink_root" isolation
dp_test_assert_eq critical "${isolation[STATUS]}" 'symlink isolation root accepted'
unlink -- "$symlink_root"

translated=
dp_exec_translate_managed_path "$root" /data/projects translated
dp_test_assert_eq "$root/data/projects" "$translated" 'logical path translation failed'
dp_test_assert_status "$DP_EXIT_DATAERR" 'logical path escape accepted' dp_exec_translate_managed_path "$root" /database translated
mkdir -- "$root/data"
ln -s -- "$root" "$root/data/projects"
dp_test_assert_status "$DP_EXIT_DATAERR" 'symlinked managed child accepted' dp_exec_translate_managed_path "$root" /data/projects translated
unlink -- "$root/data/projects"
rmdir -- "$root/data"

declare -A plan=() plan_validation=()
dp_exec_read_plan "$fixture_dir/valid-execution-plan.tsv" plan
dp_test_assert_eq 10 "${plan[COUNT]}" 'valid execution plan count'
dp_exec_validate_plan plan plan_validation
dp_test_assert_eq pass "${plan_validation[STATUS]}" 'valid execution plan rejected'
dp_test_assert_status "$DP_EXIT_DATAERR" 'invalid plan fixture accepted' dp_exec_read_plan "$fixture_dir/invalid-execution-plan.tsv" plan

dp_test_invalid_plan() {
  local label=$1 expression=$2 file=$root/invalid-plan.tsv
  sed "$expression" "$fixture_dir/valid-execution-plan.tsv" > "$file"
  declare -A unchanged=([SENTINEL]=kept)
  dp_exec_read_plan "$file" unchanged >/dev/null 2>&1 || true
  dp_test_assert_eq kept "${unchanged[SENTINEL]}" "$label changed caller state"
  dp_test_assert_status "$DP_EXIT_DATAERR" "$label" dp_exec_read_plan "$file" plan
}
dp_test_invalid_plan 'missing execution step accepted' '10d'
dp_test_invalid_plan 'duplicate execution step accepted' 's/^10\t/9\t/'
dp_test_invalid_plan 'incorrect execution order accepted' 's/^2\t/3\t/'
dp_test_invalid_plan 'unknown execution action accepted' 's/\tvalidate\texecution-plan/\tunknown\texecution-plan/'
dp_test_invalid_plan 'mutable package version accepted' 's/1.0.0-fixture1/latest/'
dp_test_invalid_plan 'unresolved package source accepted' 's/source-resolved/source-unresolved/'
dp_test_invalid_plan 'untrusted signing-key state accepted' 's/signing-key-trusted/signing-key-untrusted/'
dp_test_invalid_plan 'missing identity policy accepted' 's/,identity-policy-defined//'
dp_exec_read_plan "$fixture_dir/valid-execution-plan.tsv" plan

validation_root=
dp_test_new_exec_root validation_root
cp -- "$fixture_dir/complete-package-state.tsv" "$validation_root/package-input.tsv"
declare -A invalid_memory_plan=() transactional_report=([SENTINEL]=kept)
dp__exec_commit plan invalid_memory_plan
invalid_memory_plan[DESIRED_AFTER.1]=versions-resolved,source-unresolved,signing-key-trusted,identity-policy-defined
validation_before=$(find "$validation_root" -mindepth 1 -printf '%P %y %m %s\n' | sort | sha256sum)
dp_test_assert_status "$DP_EXIT_DATAERR" 'invalid plan execution accepted' dp__exec_execute_isolated "$validation_root" invalid_memory_plan layout transactional_report
validation_after=$(find "$validation_root" -mindepth 1 -printf '%P %y %m %s\n' | sort | sha256sum)
dp_test_assert_eq "$validation_before" "$validation_after" 'invalid plan mutated isolation root'
dp_test_assert_eq kept "${transactional_report[SENTINEL]}" 'invalid plan changed caller output'

declare -A package_state=()
for package_fixture in complete-package-state missing-package-state partial-package-state version-conflict-state source-unresolved-state; do
  dp__exec_read_package_state "$fixture_dir/$package_fixture.tsv" package_state || dp_test_fail "valid simulated package fixture rejected: $package_fixture"
done
malformed_state=$root/malformed-package.tsv
printf 'malformed\n' > "$malformed_state"
dp_test_assert_status "$DP_EXIT_DATAERR" 'malformed package state accepted' dp__exec_read_package_state "$malformed_state" package_state
duplicate_state=$root/duplicate-package.tsv
{ head -n 2 "$fixture_dir/complete-package-state.tsv"; sed -n '2p' "$fixture_dir/complete-package-state.tsv"; } > "$duplicate_state"
dp_test_assert_status "$DP_EXIT_DATAERR" 'duplicate package record accepted' dp__exec_read_package_state "$duplicate_state" package_state

declare -A layout=() report=() detected=() recovery=()
dp_install_read_filesystem_manifest "$repo_root/core/install/filesystem-layout.tsv" layout
happy_root=
dp_test_new_exec_root happy_root
cp -- "$fixture_dir/missing-package-state.tsv" "$happy_root/package-input.tsv"
dp__exec_execute_isolated "$happy_root" plan layout report
dp_test_assert_eq pass "${report[overall_status]}" 'isolated execution failed'
dp_test_assert_eq complete "${report[transaction_state]}" 'isolated transaction did not complete'
for child in projects backups logs secrets ssl scripts; do [[ -d $happy_root/data/$child && ! -L $happy_root/data/$child ]] || dp_test_fail "managed child missing: $child"; done
dp_test_assert_eq 6 "$(find "$happy_root/data" -mindepth 1 -maxdepth 1 -type d | wc -l)" 'isolated layout does not contain six direct children'
dp_test_assert_eq 755 "$(stat -c '%a' "$happy_root/data")" 'isolated data-root mode'
for child in projects backups logs; do dp_test_assert_eq 750 "$(stat -c '%a' "$happy_root/data/$child")" "isolated mode: $child"; done
for child in secrets ssl; do dp_test_assert_eq 700 "$(stat -c '%a' "$happy_root/data/$child")" "isolated mode: $child"; done
dp_test_assert_eq 755 "$(stat -c '%a' "$happy_root/data/scripts")" 'isolated scripts mode'
dp_test_assert_eq "$([ -f "$happy_root/transaction-journal.tsv" ] && printf yes)" yes 'transaction journal missing'
dp_test_assert_eq "$(<"$fixture_dir/expected-journal.tsv")" "$(<"$happy_root/transaction-journal.tsv")" 'completed journal differs from fixture'

first_text=$(dp_exec_render_text report)
first_json=$(dp_exec_render_json report)
dp__exec_execute_isolated "$happy_root" plan layout report
dp_test_assert_eq pass "${report[overall_status]}" 'idempotent re-execution failed'
dp_test_assert_eq unchanged "${report[apply_filesystem_layout.status]}" 're-execution did not preserve filesystem'
dp_test_assert_eq unchanged "${report[apply_package_state.status]}" 're-execution did not preserve package simulation'

second_root=
dp_test_new_exec_root second_root
cp -- "$fixture_dir/missing-package-state.tsv" "$second_root/package-input.tsv"
declare -A second_report=()
dp__exec_execute_isolated "$second_root" plan layout second_report
dp_test_assert_eq "$first_text" "$(dp_exec_render_text second_report)" 'identical initial state produced different text'
dp_test_assert_eq "$first_json" "$(dp_exec_render_json second_report)" 'identical initial state produced different JSON'

for state_fixture in partial-package-state version-conflict-state source-unresolved-state; do
  state_root=
  dp_test_new_exec_root state_root
  cp -- "$fixture_dir/$state_fixture.tsv" "$state_root/package-input.tsv"
  dp__exec_execute_isolated "$state_root" plan layout report
  dp_test_assert_eq critical "${report[overall_status]}" "package blocker not detected: $state_fixture"
  [[ ! -e $state_root/data ]] || dp_test_fail "filesystem mutated after package blocker: $state_fixture"
done

optional_root=
dp_test_new_exec_root optional_root
sed 's/docker-buildx-plugin\t0.20.0-fixture1\toptional\tresolved\ttrusted/docker-buildx-plugin\t0.20.0-fixture1\toptional\tunresolved\tuntrusted/' "$fixture_dir/complete-package-state.tsv" > "$optional_root/package-input.tsv"
dp__exec_execute_isolated "$optional_root" plan layout report
dp_test_assert_eq warning "${report[overall_status]}" 'optional package failure did not produce warning'
dp_test_assert_eq complete "${report[transaction_state]}" 'optional package failure prevented required completion'

conflict_root=
dp_test_new_exec_root conflict_root
cp -- "$fixture_dir/complete-package-state.tsv" "$conflict_root/package-input.tsv"
dp_exec_initialize_transaction "$conflict_root" plan detected
dp_exec_apply_simulated_packages "$conflict_root" plan detected
printf 'conflict\n' > "$conflict_root/data"
dp_exec_apply_filesystem_layout "$conflict_root" layout detected
dp_test_assert_eq critical "${detected[STATUS]}" 'conflicting data file did not block'
[[ -f $conflict_root/data ]] || dp_test_fail 'conflicting file was automatically removed'

extra_root=
dp_test_new_exec_root extra_root
cp -- "$fixture_dir/complete-package-state.tsv" "$extra_root/package-input.tsv"
dp_exec_initialize_transaction "$extra_root" plan detected
dp_exec_apply_simulated_packages "$extra_root" plan detected
mkdir -- "$extra_root/data" "$extra_root/data/extra"
dp_exec_apply_filesystem_layout "$extra_root" layout detected
dp_test_assert_eq critical "${detected[STATUS]}" 'extra direct child did not block'
[[ -d $extra_root/data/extra ]] || dp_test_fail 'extra direct child was automatically removed'

declare -A world_layout=()
dp__exec_commit layout world_layout
world_layout[MODE.1]=0777
dp_test_assert_status "$DP_EXIT_DATAERR" 'world-writable layout accepted' dp_exec_apply_filesystem_layout "$extra_root" world_layout detected

completion_root=
dp_test_new_exec_root completion_root
cp -- "$fixture_dir/complete-package-state.tsv" "$completion_root/package-input.tsv"
dp_exec_initialize_transaction "$completion_root" plan detected
dp_exec_record_completion "$completion_root" plan detected
dp_test_assert_eq critical "${detected[STATUS]}" 'completion recorded before verification'
[[ ! -e $completion_root/completion.tsv ]] || dp_test_fail 'premature completion record was created'

declare -a failure_points=("${DP_EXEC_FAILURE_POINTS[@]}")
for failure_point in "${failure_points[@]}"; do
  failure_root=
  dp_test_new_exec_root failure_root
  cp -- "$fixture_dir/complete-package-state.tsv" "$failure_root/package-input.tsv"
  printf '%s\n' "$failure_point" > "$failure_root/failure-point"
  chmod 0600 -- "$failure_root/failure-point"
  dp__exec_execute_isolated "$failure_root" plan layout report
  dp_test_assert_eq critical "${report[overall_status]}" "failure injection did not fail: $failure_point"
  dp_exec_detect_partial_install "$failure_root" plan detected
  if [[ $failure_point == before_initialize_transaction ]]; then
    dp_test_assert_eq no_previous_transaction "${detected[DETECTED_STATE]}" 'pre-initialization failure left state'
  else
    dp_test_assert_eq true "${detected[MANUAL_REVIEW_REQUIRED]}" "partial state not detected: $failure_point"
  fi
done

partial_root=
dp_test_new_exec_root partial_root
cp -- "$fixture_dir/complete-package-state.tsv" "$partial_root/package-input.tsv"
dp_exec_initialize_transaction "$partial_root" plan detected
dp_exec_detect_partial_install "$partial_root" plan detected
dp_test_assert_eq initialized_unapplied "${detected[DETECTED_STATE]}" 'initialized transaction not detected'
dp_exec_build_recovery_plan "$partial_root" plan recovery
dp_test_assert_eq critical "${recovery[overall_status]}" 'partial recovery plan not critical'
dp_test_assert_eq false "${recovery[safe_to_resume]}" 'partial transaction marked safe to resume'
dp_test_assert_eq true "${recovery[manual_review_required]}" 'partial transaction lacks manual review'

recovery_root=
dp_test_new_exec_root recovery_root
cp -- "$fixture_dir/complete-package-state.tsv" "$recovery_root/package-input.tsv"
dp_exec_initialize_transaction "$recovery_root" plan detected
dp_exec_apply_simulated_packages "$recovery_root" plan detected
dp_exec_build_recovery_plan "$recovery_root" plan recovery
printf -v recovery_text 'field\tvalue\noverall_status\t%s\ndetected_state\t%s\nsafe_to_resume\t%s\nmanual_review_required\t%s\n' "${recovery[overall_status]}" "${recovery[detected_state]}" "${recovery[safe_to_resume]}" "${recovery[manual_review_required]}"
for recovery_index in 0 1 2 3; do printf -v recovery_line 'step_%s\t%s:%s\n' "$((recovery_index + 1))" "${recovery[ID.$recovery_index]}" "${recovery[STATUS.$recovery_index]}"; recovery_text+=$recovery_line; done
dp_test_assert_eq "$(<"$fixture_dir/expected-recovery-plan.tsv")" "${recovery_text%$'\n'}" 'recovery plan differs from fixture'

declare -A mismatch_plan=()
dp__exec_commit plan mismatch_plan
mismatch_plan[PLAN_DIGEST]=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
dp_exec_detect_partial_install "$partial_root" mismatch_plan detected
dp_test_assert_eq plan_mismatch "${detected[DETECTED_STATE]}" 'plan mismatch not detected'

unknown_root=
dp_test_new_exec_root unknown_root
printf 'unknown\n' > "$unknown_root/package-state.tsv"
dp_exec_detect_partial_install "$unknown_root" plan detected
dp_test_assert_eq unknown_state "${detected[DETECTED_STATE]}" 'unknown state did not fail closed'
[[ -f $unknown_root/package-state.tsv ]] || dp_test_fail 'unknown state was automatically cleaned'

malformed_root=
dp_test_new_exec_root malformed_root
printf 'truncated\n' > "$malformed_root/transaction-journal.tsv"
dp_exec_detect_partial_install "$malformed_root" plan detected
dp_test_assert_eq malformed_journal "${detected[DETECTED_STATE]}" 'malformed journal not detected'

mode_root=
dp_test_new_exec_root mode_root
cp -- "$fixture_dir/complete-package-state.tsv" "$mode_root/package-input.tsv"
dp__exec_execute_isolated "$mode_root" plan layout report
chmod 0777 -- "$mode_root/data/projects"
dp_exec_detect_partial_install "$mode_root" plan detected
dp_test_assert_eq invalid_completion "${detected[DETECTED_STATE]}" 'post-completion mode mismatch not detected'

report[validate_execution_context.summary]='safe "quoted" marker \\ value'
escaped_json=$(dp_exec_render_json report)
dp_test_assert_contains "$escaped_json" '\"quoted\"' 'execution JSON quote escaping'
dp_test_assert_contains "$escaped_json" '\\\\ value' 'execution JSON backslash escaping'
for false_field in production_apply_authorized host_data_modified host_packages_modified production_ready; do dp_test_assert_contains "$first_json" "\"$false_field\": false" "mandatory false field: $false_field"; done
dp_test_assert_eq 10 "$(grep -c '"id":' <<< "$first_json")" 'execution JSON step count'
for prohibited in "$happy_root" hostname username group_id address credential environment pid; do dp_test_assert_not_contains "$first_text$first_json" "$prohibited" 'execution report exposed prohibited data'; done
if command -v python3 >/dev/null 2>&1; then JSON_DOCUMENT=$first_json python3 -c 'import json,os; d=json.loads(os.environ["JSON_DOCUMENT"]); assert len(d["steps"])==10; assert d["production_apply_authorized"] is d["host_data_modified"] is d["host_packages_modified"] is d["production_ready"] is False'; fi

dp_test_assert_status 0 'execution pass exit mapping' dp_exec_status_exit pass
dp_test_assert_status 1 'execution warning exit mapping' dp_exec_status_exit warning
dp_test_assert_status 2 'execution critical exit mapping' dp_exec_status_exit critical
dp_test_assert_status 70 'execution invalid exit mapping' dp_exec_status_exit invalid

network_marker=$root/network-command-marker
fake_bin=$root/fake-bin
mkdir -- "$fake_bin"
for command_name in curl wget apt apt-get systemctl docker; do printf '#!/usr/bin/env bash\nprintf invoked > "%s"\nexit 99\n' "$network_marker" > "$fake_bin/$command_name"; chmod 0755 -- "$fake_bin/$command_name"; done
PATH=$fake_bin:$PATH dp_exec_validate_plan plan plan_validation
[[ ! -e $network_marker ]] || dp_test_fail 'execution library invoked network, package, service, or Docker command'

cleanup_root=
dp_test_new_exec_root cleanup_root
declare -A cleanup_result=()
dp_exec_cleanup_test_root "$cleanup_root" cleanup_result
dp_test_assert_eq pass "${cleanup_result[STATUS]}" 'validated isolation cleanup failed'
[[ ! -e $cleanup_root ]] || dp_test_fail 'validated isolation root was not removed'

dp_test_finish 'installer execution unit tests'
