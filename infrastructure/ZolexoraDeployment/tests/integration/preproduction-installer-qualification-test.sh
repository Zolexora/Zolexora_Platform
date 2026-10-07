#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(cd -- "$script_dir/../.." && pwd -P)
readonly DP08_OPT_IN=ZOLEXORA_PREPRODUCTION_QUALIFICATION_CONFIRMED
readonly DP08_INNER=--inside-disposable-qualification

dp08_mount_has_option() {
  [[ $# -eq 2 ]] || return 64
  awk -v target="$1" -v wanted="$2" '
    $5 == target {
      count = split($6, options, ",")
      for (i = 1; i <= count; i++) if (options[i] == wanted) found = 1
    }
    END { exit(found ? 0 : 1) }
  ' /proc/self/mountinfo
}

dp08_mount_is_tmpfs() {
  [[ $# -eq 1 ]] || return 64
  awk -v target="$1" '
    $5 == target {
      for (i = 1; i <= NF; i++) if ($i == "-" && $(i + 1) == "tmpfs") found = 1
    }
    END { exit(found ? 0 : 1) }
  ' /proc/self/mountinfo
}

dp08_validate_context() {
  [[ $# -eq 6 ]] || return 64
  local opt_in=$1 container_marker=$2 root=$3 repository=$4 os_file=$5 output_name=$6
  local -A context_result=([STATUS]=critical [SUMMARY]='qualification context is invalid or unverified') isolation=() os=()
  dp__exec_is_assoc "$output_name" || return "$DP_EXIT_USAGE"
  if [[ $opt_in == "$DP08_OPT_IN" && $container_marker == /.dockerenv && -f $container_marker && ! -L $container_marker && $repository == /workspace && -d $repository && ! -L $repository ]] &&
    dp08_mount_has_option /workspace ro && dp08_mount_is_tmpfs /tmp && dp08_mount_is_tmpfs /qualification &&
    dp_exec_validate_isolation_root "$root" isolation && [[ ${isolation[STATUS]} == pass ]] &&
    dp_diag_read_os_release "$os_file" os && [[ ${os[ID]} == ubuntu && (${os[VERSION_ID]} == 24.04 || ${os[VERSION_ID]} == 26.04) ]]; then
    context_result[STATUS]=pass
    context_result[SUMMARY]='disposable pre-production qualification context validated'
  fi
  dp__exec_commit context_result "$output_name"
}

dp08_execute_locked() {
  [[ $# -eq 4 ]] || return 64
  local root=$1 plan_name=$2 layout_name=$3 output_name=$4 lock_fd= status=0
  dp__exec_require_isolation_root "$root" || return
  dp_lock_acquire "$root/qualification.lock" 0 lock_fd || return
  dp__exec_execute_isolated "$root" "$plan_name" "$layout_name" "$output_name" || status=$?
  dp_lock_release lock_fd || [[ $status -ne 0 ]] || return "$DP_EXIT_IOERR"
  return "$status"
}

dp08_inside() {
  [[ ${ZOLEXORA_PREPRODUCTION_QUALIFICATION:-} == "$DP08_OPT_IN" ]] || return 77
  [[ -f /.dockerenv && ! -L /.dockerenv ]] || return 77
  dp08_mount_has_option /workspace ro || return 77
  dp08_mount_is_tmpfs /tmp || return 77
  dp08_mount_is_tmpfs /qualification || return 77
  trap 'printf "FAIL: qualification failed at line %s\n" "$LINENO" >&2' ERR

  # shellcheck source=../lib/test-helpers.sh
  source "$repo_root/tests/lib/test-helpers.sh"
  for library in runtime validation paths diagnostics installation installer-execution locking; do
    # shellcheck disable=SC1090
    source "$repo_root/core/lib/$library.sh"
  done

  local fixture_dir=$repo_root/tests/fixtures/install/execution root= root_two= fresh_root= conflict_root= symlink_conflict_root= package_conflict_root= malformed_root= interrupted_root= contention_root=
  local source_tree=/qualification/package-source package_file=/qualification/zolexora-installer-qualification_1.0.0_all.deb unpack_root=/qualification/unpacked
  local translated= first_json= second_json= journal_before= journal_after= recovery_one= recovery_two= held_fd= competing_status=
  local -a roots=()
  local -A context=() plan=() invalid_plan=() layout=() report=() step=() detected=() recovery=()

  dp08_new_root() {
    local output_name=$1 test_root=
    dp_test_make_isolation_root test_root
    roots+=("$test_root")
    printf -v "$output_name" '%s' "$test_root"
  }
  dp08_cleanup() {
    local cleanup_root
    for cleanup_root in "${roots[@]}"; do [[ ! -d $cleanup_root ]] || dp_test_cleanup_temp_dir "$cleanup_root"; done
  }
  trap dp08_cleanup EXIT

  dp08_new_root root
  dp08_validate_context "$DP08_OPT_IN" /.dockerenv "$root" /workspace /etc/os-release context
  dp_test_assert_eq pass "${context[STATUS]}" 'valid qualification context rejected'
  dp08_validate_context missing /.dockerenv "$root" /workspace /etc/os-release context
  dp_test_assert_eq critical "${context[STATUS]}" 'missing qualification opt-in accepted'
  dp08_validate_context "$DP08_OPT_IN" /qualification/not-a-container "$root" /workspace /etc/os-release context
  dp_test_assert_eq critical "${context[STATUS]}" 'outside-container context accepted'
  dp08_validate_context "$DP08_OPT_IN" /.dockerenv /tmp/zolexora-dp07.MISSING /workspace /etc/os-release context
  dp_test_assert_eq critical "${context[STATUS]}" 'missing qualification root accepted'
  for rejected_root in / /data /opt /usr /etc /var /workspace /root relative/path '/tmp/zolexora-dp07.bad/../escape'; do
    dp08_validate_context "$DP08_OPT_IN" /.dockerenv "$rejected_root" /workspace /etc/os-release context
    dp_test_assert_eq critical "${context[STATUS]}" 'unsafe qualification root accepted'
  done
  ln -s -- "$root" /tmp/zolexora-dp07.SYMLNK
  dp08_validate_context "$DP08_OPT_IN" /.dockerenv /tmp/zolexora-dp07.SYMLNK /workspace /etc/os-release context
  dp_test_assert_eq critical "${context[STATUS]}" 'symlink qualification root accepted'
  unlink -- /tmp/zolexora-dp07.SYMLNK
  dp08_validate_context "$DP08_OPT_IN" /.dockerenv "$root" /qualification /etc/os-release context
  dp_test_assert_eq critical "${context[STATUS]}" 'writable repository assumption accepted'
  printf 'ID=unsupported\nVERSION_ID=1\n' > /qualification/unsupported-os-release
  dp08_validate_context "$DP08_OPT_IN" /.dockerenv "$root" /workspace /qualification/unsupported-os-release context
  dp_test_assert_eq critical "${context[STATUS]}" 'unsupported operating system accepted'
  [[ ! -e $root/transaction-journal.tsv ]] || dp_test_fail 'guard rejection created a journal'

  dp_exec_read_plan "$fixture_dir/valid-execution-plan.tsv" plan
  dp_install_read_filesystem_manifest "$repo_root/core/install/filesystem-layout.tsv" layout
  sed '1s/^sequence/plan_version/' "$fixture_dir/valid-execution-plan.tsv" > /qualification/unknown-plan-version.tsv
  dp_test_assert_status "$DP_EXIT_DATAERR" 'unknown plan version accepted' dp_exec_read_plan /qualification/unknown-plan-version.tsv invalid_plan
  sed 's/\tvalidate\texecution-plan/\tunknown\texecution-plan/' "$fixture_dir/valid-execution-plan.tsv" > /qualification/unknown-operation.tsv
  dp_test_assert_status "$DP_EXIT_DATAERR" 'unknown operation accepted' dp_exec_read_plan /qualification/unknown-operation.tsv invalid_plan

  command -v dpkg-deb >/dev/null || dp_test_fail 'package-building tool unavailable'
  command -v dpkg >/dev/null || dp_test_fail 'package inspection tool unavailable'
  mkdir -p -- "$source_tree/DEBIAN" "$source_tree/usr/share/zolexora-installer-qualification" "$unpack_root"
  printf 'Package: zolexora-installer-qualification\nVersion: 1.0.0\nArchitecture: all\nMaintainer: Qualification Test\nDescription: inert offline installer qualification payload\n' > "$source_tree/DEBIAN/control"
  printf 'offline qualification payload\n' > "$source_tree/usr/share/zolexora-installer-qualification/payload.txt"
  chmod 0755 -- "$source_tree" "$source_tree/DEBIAN" "$source_tree/usr" "$source_tree/usr/share" "$source_tree/usr/share/zolexora-installer-qualification"
  chmod 0644 -- "$source_tree/DEBIAN/control" "$source_tree/usr/share/zolexora-installer-qualification/payload.txt"
  [[ -z $(find "$source_tree/DEBIAN" -mindepth 1 -maxdepth 1 ! -name control -print -quit) ]] || dp_test_fail 'synthetic package contains a maintainer script'
  dpkg-deb --build --root-owner-group "$source_tree" "$package_file" >/dev/null 2>&1
  [[ -s $package_file && -f $package_file && ! -L $package_file ]] || dp_test_fail 'synthetic package was not created'
  dpkg-deb --info "$package_file" >/dev/null 2>&1 || dp_test_fail 'synthetic package metadata is invalid'
  dpkg-deb -x "$package_file" "$unpack_root"
  local payload=$unpack_root/usr/share/zolexora-installer-qualification/payload.txt payload_before
  dp_test_assert_eq 'offline qualification payload' "$(<"$payload")" 'synthetic payload differs'
  dp_test_assert_eq 644 "$(stat -c '%a' -- "$payload")" 'synthetic payload mode differs'
  dp_test_assert_eq 0 "$(stat -c '%u' -- "$payload")" 'synthetic payload owner differs'
  dp_test_assert_eq 0 "$(stat -c '%g' -- "$payload")" 'synthetic payload group differs'
  payload_before=$(sha256sum -- "$payload")
  dpkg-deb -x "$package_file" "$unpack_root"
  dp_test_assert_eq "$payload_before" "$(sha256sum -- "$payload")" 'synthetic package reprocessing changed payload'
  if dpkg-query -W -f='${Status}' zolexora-installer-qualification >/dev/null 2>&1; then dp_test_fail 'synthetic package entered the container package database'; fi
  printf 'not a package\n' > /qualification/malformed.deb
  if dpkg-deb --info /qualification/malformed.deb >/dev/null 2>&1; then dp_test_fail 'malformed package input accepted'; fi

  cp -- "$fixture_dir/missing-package-state.tsv" "$root/package-input.tsv"
  dp08_execute_locked "$root" plan layout report
  dp_test_assert_eq pass "${report[overall_status]}" 'qualified first execution failed'
  dp_test_assert_eq complete "${report[transaction_state]}" 'qualified transaction incomplete'
  dp_test_assert_eq "$([ -f "$root/transaction-journal.tsv" ] && printf yes)" yes 'qualification journal missing'
  dp_test_assert_eq "$(<"$fixture_dir/expected-journal.tsv")" "$(<"$root/transaction-journal.tsv")" 'qualification journal is nondeterministic'
  for path_mode in 'data 755' 'data/projects 750' 'data/backups 750' 'data/logs 750' 'data/secrets 700' 'data/ssl 700' 'data/scripts 755'; do
    read -r relative expected_mode <<< "$path_mode"
    dp_test_assert_eq "$expected_mode" "$(stat -c '%a' -- "$root/$relative")" "qualified mode differs: $relative"
  done
  first_json=$(dp_exec_render_json report)
  dp08_execute_locked "$root" plan layout report
  dp_test_assert_eq unchanged "${report[apply_package_state.status]}" 'qualified package re-execution changed state'
  dp_test_assert_eq unchanged "${report[apply_filesystem_layout.status]}" 'qualified filesystem re-execution changed state'

  dp08_new_root fresh_root
  cp -- "$fixture_dir/missing-package-state.tsv" "$fresh_root/package-input.tsv"
  dp08_execute_locked "$fresh_root" plan layout report
  second_json=$(dp_exec_render_json report)
  dp_test_assert_eq "$first_json" "$second_json" 'qualified execution evidence is nondeterministic'

  dp08_new_root conflict_root
  cp -- "$fixture_dir/complete-package-state.tsv" "$conflict_root/package-input.tsv"
  dp_exec_initialize_transaction "$conflict_root" plan step
  dp_exec_apply_simulated_packages "$conflict_root" plan step
  printf 'conflict\n' > "$conflict_root/data"
  dp_exec_apply_filesystem_layout "$conflict_root" layout step
  dp_test_assert_eq critical "${step[STATUS]}" 'file-directory conflict did not fail closed'

  dp08_new_root symlink_conflict_root
  cp -- "$fixture_dir/complete-package-state.tsv" "$symlink_conflict_root/package-input.tsv"
  dp_exec_initialize_transaction "$symlink_conflict_root" plan step
  dp_exec_apply_simulated_packages "$symlink_conflict_root" plan step
  ln -s -- /qualification "$symlink_conflict_root/data"
  dp_test_assert_status "$DP_EXIT_DATAERR" 'symlink conflict did not fail closed' dp_exec_apply_filesystem_layout "$symlink_conflict_root" layout step
  [[ -L $symlink_conflict_root/data ]] || dp_test_fail 'symlink conflict was altered'
  dp_test_assert_status "$DP_EXIT_DATAERR" 'managed path escape accepted' dp_exec_translate_managed_path "$root" /database translated

  dp08_new_root package_conflict_root
  cp -- "$fixture_dir/version-conflict-state.tsv" "$package_conflict_root/package-input.tsv"
  dp08_execute_locked "$package_conflict_root" plan layout report
  dp_test_assert_eq critical "${report[overall_status]}" 'package version conflict did not fail closed'
  dp_exec_detect_partial_install "$package_conflict_root" plan detected
  dp_test_assert_eq initialized_unapplied "${detected[DETECTED_STATE]}" 'package failure journal evidence differs'

  dp08_new_root malformed_root
  printf 'malformed\n' > "$malformed_root/package-input.tsv"
  dp08_execute_locked "$malformed_root" plan layout report
  dp_test_assert_eq critical "${report[overall_status]}" 'malformed package state did not fail closed'
  [[ ! -e $malformed_root/data ]] || dp_test_fail 'malformed package state mutated filesystem layout'

  dp08_new_root interrupted_root
  cp -- "$fixture_dir/complete-package-state.tsv" "$interrupted_root/package-input.tsv"
  printf 'after_package_state\n' > "$interrupted_root/failure-point"
  chmod 0600 -- "$interrupted_root/failure-point"
  dp08_execute_locked "$interrupted_root" plan layout report
  dp_test_assert_eq critical "${report[overall_status]}" 'injected interruption did not fail'
  dp_exec_detect_partial_install "$interrupted_root" plan detected
  dp_test_assert_eq partial_install "${detected[DETECTED_STATE]}" 'interrupted state was not detected'
  dp_test_assert_eq failed "${report[apply_package_state.status]}" 'interrupted step was not marked failed'
  dp_test_assert_eq verified "${report[validate_execution_context.status]}" 'completed validation was not preserved'
  dp_test_assert_eq skipped "${report[apply_filesystem_layout.status]}" 'later filesystem step was not skipped'
  dp_exec_build_recovery_plan "$interrupted_root" plan recovery
  dp_test_assert_eq critical "${recovery[overall_status]}" 'interrupted recovery plan is not critical'
  dp_test_assert_eq false "${recovery[safe_to_resume]}" 'interrupted state marked safe to resume'
  dp_test_assert_eq true "${recovery[manual_review_required]}" 'interrupted state lacks manual review'
  recovery_one="${recovery[overall_status]}|${recovery[detected_state]}|${recovery[safe_to_resume]}|${recovery[manual_review_required]}"
  for index in 0 1 2 3; do recovery_one+="|${recovery[ID.$index]}:${recovery[STATUS.$index]}:${recovery[SUMMARY.$index]}"; done
  dp_exec_build_recovery_plan "$interrupted_root" plan recovery
  recovery_two="${recovery[overall_status]}|${recovery[detected_state]}|${recovery[safe_to_resume]}|${recovery[manual_review_required]}"
  for index in 0 1 2 3; do recovery_two+="|${recovery[ID.$index]}:${recovery[STATUS.$index]}:${recovery[SUMMARY.$index]}"; done
  dp_test_assert_eq "$recovery_one" "$recovery_two" 'recovery evidence is nondeterministic'
  journal_before=$(<"$interrupted_root/transaction-journal.tsv")
  dp08_execute_locked "$interrupted_root" plan layout report
  journal_after=$(<"$interrupted_root/transaction-journal.tsv")
  dp_test_assert_eq "$journal_before" "$journal_after" 'rerun corrupted interrupted journal evidence'
  dp_test_assert_status 64 'public resume option became available' bash -c '"$1" --resume >/dev/null 2>&1' _ "$repo_root/install.sh"
  dp_test_assert_status 64 'public recovery option became available' bash -c '"$1" --recover >/dev/null 2>&1' _ "$repo_root/install.sh"

  dp08_new_root contention_root
  cp -- "$fixture_dir/complete-package-state.tsv" "$contention_root/package-input.tsv"
  held_fd=
  dp_lock_acquire "$contention_root/qualification.lock" 0 held_fd
  declare -A blocked_report=([SENTINEL]=kept)
  if dp08_execute_locked "$contention_root" plan layout blocked_report; then competing_status=0; else competing_status=$?; fi
  dp_test_assert_eq "$DP_EXIT_TEMPFAIL" "$competing_status" 'same-root lock contention did not fail deterministically'
  dp_test_assert_eq kept "${blocked_report[SENTINEL]}" 'lock contention changed caller output'
  [[ ! -e $contention_root/transaction-journal.tsv && ! -e $contention_root/data ]] || dp_test_fail 'lock contention allowed mutation'
  dp08_new_root root_two
  cp -- "$fixture_dir/complete-package-state.tsv" "$root_two/package-input.tsv"
  dp08_execute_locked "$root_two" plan layout report
  dp_test_assert_eq complete "${report[transaction_state]}" 'distinct-root qualification was incorrectly blocked'
  dp_lock_release held_fd
  dp08_execute_locked "$contention_root" plan layout report
  dp_test_assert_eq complete "${report[transaction_state]}" 'qualification did not proceed after lock release'
  [[ -f $contention_root/qualification.lock ]] || dp_test_fail 'stale lock file was removed'

  if ((DP_TEST_FAILURES > 0)); then
    printf 'FAIL: pre-production qualification assertions failed\n' >&2
    return 1
  fi
  printf '%s\n' "$first_json"
}

if [[ ${1-} == "$DP08_INNER" ]]; then
  [[ $# -eq 1 ]] || exit 64
  dp08_inside
  exit
fi

[[ $# -eq 0 ]] || { printf 'ERROR: pre-production qualification test accepts no arguments\n' >&2; exit 64; }
if [[ ${ZOLEXORA_PREPRODUCTION_QUALIFICATION:-} != "$DP08_OPT_IN" ]]; then
  printf 'SKIP: pre-production qualification requires explicit test-only opt-in\n'
  exit 77
fi
command -v docker >/dev/null 2>&1 || { printf 'SKIP: Docker is unavailable\n'; exit 77; }
docker version --format '{{.Server.Version}}' >/dev/null 2>&1 || { printf 'SKIP: Docker daemon access is unavailable\n'; exit 77; }
for image in ubuntu:24.04 ubuntu:26.04; do docker image inspect "$image" >/dev/null 2>&1 || { printf 'SKIP: required local Ubuntu image is unavailable\n'; exit 77; }; done

declare -a evidence=()
for image in ubuntu:24.04 ubuntu:26.04; do
  evidence+=("$(docker run --rm --pull=never --network none --cap-drop ALL --security-opt no-new-privileges \
    --read-only --tmpfs /tmp:rw,nosuid,nodev,mode=1777 --tmpfs /qualification:rw,nosuid,nodev,mode=0700 \
    --env "ZOLEXORA_PREPRODUCTION_QUALIFICATION=$DP08_OPT_IN" \
    --mount "type=bind,src=$repo_root,dst=/workspace,readonly" \
    "$image" /bin/bash /workspace/tests/integration/preproduction-installer-qualification-test.sh "$DP08_INNER")")
done
[[ ${evidence[0]} == "${evidence[1]}" ]] || { printf 'FAIL: qualification evidence differs between supported Ubuntu versions\n' >&2; exit 1; }
for false_field in production_apply_authorized host_data_modified host_packages_modified production_ready; do grep -q "\"$false_field\": false" <<< "${evidence[0]}"; done
if command -v python3 >/dev/null 2>&1; then printf '%s\n' "${evidence[0]}" | python3 -m json.tool >/dev/null; fi
printf 'PASS: offline pre-production installer qualification on Ubuntu 24.04 and 26.04\n'
