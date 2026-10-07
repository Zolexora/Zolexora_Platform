#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(git -C "$script_dir" rev-parse --show-toplevel)
# shellcheck source=../lib/test-helpers.sh
source "$repo_root/tests/lib/test-helpers.sh"

libraries=(runtime validation paths config locking release diagnostics installation installer-execution)
library_paths=()
for library in "${libraries[@]}"; do
  path="$repo_root/core/lib/$library.sh"
  library_paths+=("$path")
  [[ -s $path ]] || dp_test_fail "missing or empty library: $library"
  bash -n "$path" || dp_test_fail "invalid Bash syntax: $library"
  dp_test_assert_eq 644 "$(stat -c '%a' "$path")" "wrong library mode: $library"
  [[ ! -x $path ]] || dp_test_fail "library is executable: $library"
done

for path in "${library_paths[@]}"; do
  while IFS= read -r declaration; do
    function_name=${declaration%%(*}
    function_name=${function_name//[[:space:]]/}
    [[ $function_name == dp_* ]] || dp_test_fail "non-namespaced function in ${path##*/}"
  done < <(grep -E '^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*[[:space:]]*\(\)' "$path")

  executable_code=$(sed -E '/^[[:space:]]*#/d; /^[[:space:]]*$/d' "$path")
  forbidden_commands='^[[:space:]]*(eval|sudo|service|ssh|curl|wget|ping|dig|host|nslookup|aws|oci|az|gcloud|gh|gitlab|cloudflare)([[:space:]]|$)'
  if [[ ${path##*/} != installer-execution.sh ]]; then forbidden_commands='^[[:space:]]*(eval|sudo|rm|service|ssh|curl|wget|ping|dig|host|nslookup|aws|oci|az|gcloud|gh|gitlab|cloudflare)([[:space:]]|$)'; fi
  if grep -Eq "$forbidden_commands" <<< "$executable_code"; then
    dp_test_fail "forbidden command in ${path##*/}"
  fi
  if [[ ${path##*/} != diagnostics.sh ]] && grep -Eq '^[[:space:]]*(docker|nginx|systemctl)([[:space:]]|$)' <<< "$executable_code"; then
    dp_test_fail "forbidden service inspection in ${path##*/}"
  fi
  if grep -Eq 'systemctl[[:space:]]+(start|stop|restart|reload|enable|disable|mask|daemon-reload)|docker[[:space:]]+(run|pull|build|push|rm)|nginx[[:space:]]+-[sT]' <<< "$executable_code"; then
    dp_test_fail "service mutation in ${path##*/}"
  fi
  if [[ ${path##*/} != installer-execution.sh ]] && grep -Eq 'apt(-get)?[[:space:]]+(update|install|upgrade|dist-upgrade|remove|purge)|^[[:space:]]*(chown|chmod|useradd|groupadd|usermod|mount|umount)([[:space:]]|$)' <<< "$executable_code"; then
    dp_test_fail "package or filesystem mutation in ${path##*/}"
  fi
  if grep -Eq '^[[:space:]]*(env|printenv)([[:space:]]|$)|compgen[[:space:]]+-e|/proc/[^/]+/environ' <<< "$executable_code"; then
    dp_test_fail "environment enumeration in ${path##*/}"
  fi
  if grep -Eq '(^|[[:space:]])image:[[:space:]]*[^[:space:]]*:latest([[:space:]]|$)' <<< "$executable_code"; then
    dp_test_fail "mutable production image reference in ${path##*/}"
  fi
  if grep -Fq 'tests/lib/test-helpers.sh' "$path"; then
    dp_test_fail "production library references test helpers: ${path##*/}"
  fi
  if grep -Fq 'tests/fixtures' "$path"; then
    dp_test_fail "production library references test fixtures: ${path##*/}"
  fi
done

temp_dir=
dp_test_make_temp_dir temp_dir
trap 'dp_test_cleanup_temp_dir "$temp_dir"' EXIT
if source_output=$(
  {
    cd -- "$temp_dir"
    original_directory=$PWD
    original_options=$(set +o)
    original_traps=$(trap -p)
    for path in "${library_paths[@]}"; do source "$path"; done
    for path in "${library_paths[@]}"; do source "$path"; done
    [[ $PWD == "$original_directory" ]]
    [[ $(set +o) == "$original_options" ]]
    [[ $(trap -p) == "$original_traps" ]]
  } 2>&1
); then
  source_status=0
else
  source_status=$?
fi
dp_test_assert_eq 0 "$source_status" 'sourcing libraries failed or changed directory'
dp_test_assert_eq '' "$source_output" 'sourcing libraries produced output'
if find "$temp_dir" -mindepth 1 -print -quit | grep -q .; then
  dp_test_fail 'sourcing libraries created a file or lock'
fi

for path in "${library_paths[@]}"; do source "$path"; done
expected_functions=(
  dp_log_set_level dp_log dp_log_field dp_redact dp_die dp_command_exists
  dp_is_nonempty dp_is_valid_identifier dp_require_identifier dp_is_valid_config_key
  dp_is_valid_uint dp_require_uint_range dp_is_valid_release_id
  dp_is_valid_image_reference dp_is_valid_rfc3339_utc
  dp_path_canonicalize dp_path_contains_traversal dp_path_is_within
  dp_assert_safe_managed_path dp_assert_safe_destructive_target
  dp_config_load dp_config_require_keys dp_config_get
  dp_lock_acquire dp_lock_release
  dp_release_validate dp_release_metadata_render dp_release_metadata_load
  dp_diag_read_os_release dp_diag_read_cpu_count dp_diag_read_memory_kib
  dp_diag_check_filesystem dp_diag_inventory_commands dp_diag_parse_listener_text
  dp_diag_collect dp_diag_render_text dp_diag_render_json dp_diag_status_exit
  dp_install_read_filesystem_manifest dp_install_read_package_manifest
  dp_install_validate_layout dp_install_inspect_layout dp_install_parse_dpkg_status
  dp_install_inventory_packages dp_install_build_plan dp_install_render_text
  dp_install_render_json dp_install_status_exit
  dp_exec_validate_isolation_root dp_exec_translate_managed_path dp_exec_read_plan
  dp_exec_validate_plan dp_exec_initialize_transaction dp_exec_apply_simulated_packages
  dp_exec_apply_filesystem_layout dp_exec_verify_postconditions dp_exec_record_completion
  dp_exec_detect_partial_install dp_exec_build_recovery_plan dp_exec_render_text
  dp_exec_render_json dp_exec_status_exit dp_exec_cleanup_test_root
)
for function_name in "${expected_functions[@]}"; do
  declare -F "$function_name" >/dev/null || dp_test_fail "missing public function: $function_name"
done

dp_test_finish 'library contract tests'
