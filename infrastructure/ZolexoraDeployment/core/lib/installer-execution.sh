#!/usr/bin/env bash

if [[ ${DP_INSTALLER_EXECUTION_SH_LOADED:-0} == 1 ]]; then
  return 0 2>/dev/null || exit 0
fi
readonly DP_INSTALLER_EXECUTION_SH_LOADED=1

readonly DP_EXEC_CONTRACT_VERSION=1
readonly DP_EXEC_ISOLATION_MARKER_NAME=.zolexora-dp07-isolation
readonly DP_EXEC_ISOLATION_MARKER_VALUE=ZOLEXORA_DP07_ISOLATION_ROOT_V1
readonly -a DP_EXEC_STEP_IDS=(
  validate_execution_context validate_resolved_plan initialize_transaction
  apply_package_state establish_service_identity_policy apply_filesystem_layout
  verify_postconditions record_completion evaluate_recovery_state finalize_transaction
)
readonly -a DP_EXEC_FAILURE_POINTS=(
  before_initialize_transaction after_initialize_transaction after_package_state
  after_identity_policy after_data_root
  after_each_data_child:projects after_each_data_child:backups
  after_each_data_child:logs after_each_data_child:secrets
  after_each_data_child:ssl after_each_data_child:scripts
  after_modes before_postcondition_verification after_postcondition_verification
  before_completion_record
)

dp__exec_is_assoc() {
  dp__install_is_assoc "${1-}"
}

dp__exec_commit() {
  dp__install_commit "$@"
}

dp__exec_safe_summary() {
  [[ $# -eq 1 && -n $1 && $1 != *[[:cntrl:]]* ]]
}

dp__exec_safe_token() {
  [[ $# -eq 1 && -n $1 && $1 =~ ^[A-Za-z0-9_.,:+/=-]+$ ]]
}

dp__exec_result() {
  [[ $# -eq 4 ]] || return "$DP_EXIT_USAGE"
  local output_name=$1 status=$2 step_status=$3 summary=$4
  local -A result=([STATUS]="$status" [STEP_STATUS]="$step_status" [SUMMARY]="$summary")
  dp__exec_is_assoc "$output_name" || return "$DP_EXIT_USAGE"
  [[ $status == pass || $status == warning || $status == critical ]] || return "$DP_EXIT_DATAERR"
  [[ $step_status == pending || $step_status == skipped || $step_status == applied || $step_status == unchanged || $step_status == blocked || $step_status == failed || $step_status == verified ]] || return "$DP_EXIT_DATAERR"
  dp__exec_safe_summary "$summary" || return "$DP_EXIT_DATAERR"
  dp__exec_commit result "$output_name"
}

dp_exec_validate_isolation_root() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local root=$1 output_name=$2 canonical parent marker mode repository_root workspace_root current_directory home_directory
  local -A result=()
  dp__exec_is_assoc "$output_name" || return "$DP_EXIT_USAGE"
  result[STATUS]=critical
  result[SUMMARY]='isolation root is invalid or unverified'
  if [[ -n $root && $root == /tmp/zolexora-dp07.* && $root =~ ^/tmp/zolexora-dp07\.[A-Za-z0-9]{6,}$ && $root != *[[:cntrl:]]* && $root != *'..'* && ! -L $root && -d $root && -O $root ]]; then
    canonical=$(realpath -e -- "$root" 2>/dev/null) || canonical=
    parent=$(realpath -e -- "${root%/*}" 2>/dev/null) || parent=
    current_directory=$(pwd -P 2>/dev/null) || current_directory=
    repository_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd -P) || repository_root=
    workspace_root=${repository_root%/*}
    home_directory=$(realpath -e -- "${HOME:-/nonexistent-home}" 2>/dev/null) || home_directory=/nonexistent-home
    marker=$root/$DP_EXEC_ISOLATION_MARKER_NAME
    mode=$(stat -c '%a' -- "$root" 2>/dev/null) || mode=
    if [[ $canonical == "$root" && $parent == /tmp && $mode == 700 && $root != / && $root != /data && $root != /tmp && $root != "$repository_root" && $root != "$workspace_root" && $root != "$current_directory" && $root != "$home_directory" && -f $marker && ! -L $marker && -O $marker && $(stat -c '%a' -- "$marker" 2>/dev/null) == 600 && $(<"$marker") == "$DP_EXEC_ISOLATION_MARKER_VALUE" ]]; then
      result[STATUS]=pass
      result[SUMMARY]='validated disposable isolation root'
    fi
  fi
  dp__exec_commit result "$output_name"
}

dp__exec_require_isolation_root() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local -A validation=()
  dp_exec_validate_isolation_root "$1" validation || return
  [[ ${validation[STATUS]} == pass ]] || return "$DP_EXIT_NOPERM"
}

dp_exec_translate_managed_path() {
  [[ $# -eq 3 ]] || return "$DP_EXIT_USAGE"
  local root=$1 logical=$2 output_name=$3 result_path
  dp__install_valid_variable_name "$output_name" || return "$DP_EXIT_USAGE"
  dp__exec_require_isolation_root "$root" || return
  dp__install_layout_path_ok "$logical" || return "$DP_EXIT_DATAERR"
  result_path=$root$logical
  [[ $result_path == "$root/data" || $result_path == "$root/data/"* ]] || return "$DP_EXIT_DATAERR"
  [[ ! -L $root/data && ! -L $result_path ]] || return "$DP_EXIT_DATAERR"
  local -n dp__exec_translate_output_ref=$output_name
  dp__exec_translate_output_ref=$result_path
}

dp__exec_expected_plan_record() {
  [[ $# -eq 8 ]] || return "$DP_EXIT_USAGE"
  local sequence=$1 id=$2 action_name=$3 target_name=$4 before_name=$5 after_name=$6 reversible_name=$7 failure_name=$8
  local action target before after reversible
  for name in "$action_name" "$target_name" "$before_name" "$after_name" "$reversible_name" "$failure_name"; do dp__install_valid_variable_name "$name" || return "$DP_EXIT_DATAERR"; done
  case $sequence:$id in
    1:validate_execution_context) action=validate; target=isolation-root; before=marker-present; after=validated-isolation; reversible=no ;;
    2:validate_resolved_plan) action=validate; target=execution-plan; before=resolved; after=versions-resolved,source-resolved,signing-key-trusted,identity-policy-defined; reversible=no ;;
    3:initialize_transaction) action=initialize; target=journal; before=absent; after=initialized; reversible=yes ;;
    4:apply_package_state) action=simulate; target=package-state; before=fixture-state; after='bash=1.0.0-fixture1=required,docker-ce=29.0.0-fixture1=required,docker-compose-plugin=5.0.0-fixture1=required,docker-buildx-plugin=0.20.0-fixture1=optional'; reversible=yes ;;
    5:establish_service_identity_policy) action=simulate; target=identity-policy; before=policy-defined; after=matches-policy; reversible=yes ;;
    6:apply_filesystem_layout) action=create; target=/data; before=absent-or-compatible; after=contract-layout; reversible=yes ;;
    7:verify_postconditions) action=verify; target=isolated-state; before=applied; after=verified; reversible=no ;;
    8:record_completion) action=record; target=completion-record; before=absent; after=complete; reversible=yes ;;
    9:evaluate_recovery_state) action=evaluate; target=recovery-state; before=known; after=not-required; reversible=no ;;
    10:finalize_transaction) action=finalize; target=transaction; before=applying; after=complete; reversible=no ;;
    *) return "$DP_EXIT_DATAERR" ;;
  esac
  printf -v "$action_name" '%s' "$action"
  printf -v "$target_name" '%s' "$target"
  printf -v "$before_name" '%s' "$before"
  printf -v "$after_name" '%s' "$after"
  printf -v "$reversible_name" '%s' "$reversible"
  printf -v "$failure_name" '%s' stop
}

dp__exec_parse_desired_packages() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local value=$1 output_name=$2 item package version requirement extra index=0
  local -a items=()
  local -A parsed=() seen=()
  dp__exec_is_assoc "$output_name" || return "$DP_EXIT_USAGE"
  IFS=',' read -r -a items <<< "$value"
  ((${#items[@]} > 0)) || return "$DP_EXIT_DATAERR"
  for item in "${items[@]}"; do
    IFS='=' read -r package version requirement extra <<< "$item"
    [[ -n $package && -n $version && -n $requirement && -z ${extra-} ]] || return "$DP_EXIT_DATAERR"
    [[ $package =~ ^[a-z0-9][a-z0-9+.-]*$ && $version =~ ^[0-9][A-Za-z0-9.+:~_-]{0,63}$ && ${version,,} != latest && ($requirement == required || $requirement == optional) ]] || return "$DP_EXIT_DATAERR"
    [[ ! -v seen[$package] ]] || return "$DP_EXIT_DATAERR"
    seen[$package]=1
    parsed["PACKAGE.$index"]=$package
    parsed["VERSION.$index"]=$version
    parsed["REQUIREMENT.$index"]=$requirement
    index=$((index + 1))
  done
  parsed[COUNT]=$index
  dp__exec_commit parsed "$output_name"
}

dp__exec_plan_valid() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local plan_name=$1 index expected_action expected_target expected_before expected_after expected_reversible expected_failure
  local -A desired_packages=()
  dp__exec_is_assoc "$plan_name" || return "$DP_EXIT_USAGE"
  local -n plan_ref=$plan_name
  [[ ${plan_ref[COUNT]-} == 10 ]] || return 1
  for ((index=0; index<10; index++)); do
    [[ ${plan_ref["SEQUENCE.$index"]-} == $((index + 1)) && ${plan_ref["ID.$index"]-} == "${DP_EXEC_STEP_IDS[$index]}" ]] || return 1
    dp__exec_expected_plan_record "$((index + 1))" "${DP_EXEC_STEP_IDS[$index]}" expected_action expected_target expected_before expected_after expected_reversible expected_failure || return 1
    [[ ${plan_ref["ACTION.$index"]-} == "$expected_action" && ${plan_ref["TARGET.$index"]-} == "$expected_target" && ${plan_ref["EXPECTED_BEFORE.$index"]-} == "$expected_before" && ${plan_ref["DESIRED_AFTER.$index"]-} == "$expected_after" && ${plan_ref["REVERSIBLE.$index"]-} == "$expected_reversible" && ${plan_ref["FAILURE_POLICY.$index"]-} == "$expected_failure" ]] || return 1
    for field in ACTION TARGET EXPECTED_BEFORE DESIRED_AFTER REVERSIBLE FAILURE_POLICY; do dp__exec_safe_token "${plan_ref["$field.$index"]-}" || return 1; done
    [[ ${plan_ref["DESIRED_AFTER.$index"],,} != *latest* ]] || return 1
  done
  dp__exec_parse_desired_packages "${plan_ref[DESIRED_AFTER.3]}" desired_packages || return 1
}

dp__exec_plan_canonical() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local plan_name=$1 index
  dp__exec_plan_valid "$plan_name" || return "$DP_EXIT_DATAERR"
  local -n plan_ref=$plan_name
  printf 'sequence\tid\taction\ttarget\texpected_before\tdesired_after\treversible\tfailure_policy\n'
  for ((index=0; index<10; index++)); do
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "${plan_ref["SEQUENCE.$index"]}" "${plan_ref["ID.$index"]}" "${plan_ref["ACTION.$index"]}" "${plan_ref["TARGET.$index"]}" "${plan_ref["EXPECTED_BEFORE.$index"]}" "${plan_ref["DESIRED_AFTER.$index"]}" "${plan_ref["REVERSIBLE.$index"]}" "${plan_ref["FAILURE_POLICY.$index"]}"
  done
}

dp_exec_read_plan() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local file=$1 output_name=$2 line line_number=0 index=0 digest field
  local -a fields=()
  local -A parsed=() seen_sequence=() seen_id=()
  dp__exec_is_assoc "$output_name" || return "$DP_EXIT_USAGE"
  dp__install_manifest_file_ok "$file" || return
  while IFS= read -r line || [[ -n $line ]]; do
    line_number=$((line_number + 1))
    [[ $line != *$'\r' ]] || line=${line%$'\r'}
    IFS=$'\t' read -r -a fields <<< "$line"
    if ((line_number == 1)); then
      [[ $line == $'sequence\tid\taction\ttarget\texpected_before\tdesired_after\treversible\tfailure_policy' ]] || return "$DP_EXIT_DATAERR"
      continue
    fi
    ((${#fields[@]} == 8)) || return "$DP_EXIT_DATAERR"
    dp_require_uint_range "${fields[0]}" 1 10 sequence >/dev/null 2>&1 || return "$DP_EXIT_DATAERR"
    [[ ${fields[1]} =~ ^[a-z][a-z0-9_]{0,63}$ ]] || return "$DP_EXIT_DATAERR"
    [[ ! -v seen_sequence["${fields[0]}"] && ! -v seen_id["${fields[1]}"] ]] || return "$DP_EXIT_DATAERR"
    for field in "${fields[@]:2}"; do dp__exec_safe_token "$field" || return "$DP_EXIT_DATAERR"; done
    seen_sequence["${fields[0]}"]=1
    seen_id["${fields[1]}"]=1
    parsed["SEQUENCE.$index"]=${fields[0]}
    parsed["ID.$index"]=${fields[1]}
    parsed["ACTION.$index"]=${fields[2]}
    parsed["TARGET.$index"]=${fields[3]}
    parsed["EXPECTED_BEFORE.$index"]=${fields[4]}
    parsed["DESIRED_AFTER.$index"]=${fields[5]}
    parsed["REVERSIBLE.$index"]=${fields[6]}
    parsed["FAILURE_POLICY.$index"]=${fields[7]}
    index=$((index + 1))
  done < "$file"
  parsed[COUNT]=$index
  dp__exec_plan_valid parsed || return "$DP_EXIT_DATAERR"
  dp_command_exists sha256sum || return "$DP_EXIT_UNAVAILABLE"
  digest=$(dp__exec_plan_canonical parsed | sha256sum) || return "$DP_EXIT_IOERR"
  digest=${digest%% *}
  [[ $digest =~ ^[0-9a-f]{64}$ ]] || return "$DP_EXIT_DATAERR"
  parsed[PLAN_DIGEST]=$digest
  dp__exec_commit parsed "$output_name"
}

dp_exec_validate_plan() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local plan_name=$1 output_name=$2
  local -A result=()
  dp__exec_is_assoc "$output_name" || return "$DP_EXIT_USAGE"
  if dp__exec_plan_valid "$plan_name"; then result[STATUS]=pass; result[SUMMARY]='immutable isolated execution plan is valid'; else result[STATUS]=critical; result[SUMMARY]='execution plan is invalid or unresolved'; fi
  dp__exec_commit result "$output_name"
}

dp__exec_atomic_write() {
  [[ $# -eq 4 ]] || return "$DP_EXIT_USAGE"
  local root=$1 relative=$2 content=$3 mode=$4 target next
  dp__exec_require_isolation_root "$root" || return
  [[ $relative =~ ^[a-z0-9][a-z0-9.-]*$ && $mode =~ ^0[0-7]{3}$ ]] || return "$DP_EXIT_DATAERR"
  target=$root/$relative
  next=$root/.dp07-write-next
  [[ ! -L $target && (! -e $target || -f $target) && ! -e $next && ! -L $next ]] || return "$DP_EXIT_CANTCREAT"
  (umask 077; printf '%s\n' "$content" > "$next") || return "$DP_EXIT_IOERR"
  chmod "$mode" -- "$next" || return "$DP_EXIT_IOERR"
  mv -f -- "$next" "$target" || return "$DP_EXIT_IOERR"
}

dp__exec_write_journal() {
  [[ $# -eq 7 ]] || return "$DP_EXIT_USAGE"
  local root=$1 state=$2 digest=$3 sequence=$4 step=$5 step_status=$6 summary=$7 content
  [[ $state =~ ^(initialized|applying|blocked|failed|complete|recovery_required)$ && $digest =~ ^[0-9a-f]{64}$ ]] || return "$DP_EXIT_DATAERR"
  dp_require_uint_range "$sequence" 0 10 sequence >/dev/null 2>&1 || return "$DP_EXIT_DATAERR"
  [[ $step == none || $step == "${DP_EXEC_STEP_IDS[$((sequence > 0 ? sequence - 1 : 0))]}" ]] || return "$DP_EXIT_DATAERR"
  [[ $step_status =~ ^(pending|skipped|applied|unchanged|blocked|failed|verified)$ ]] || return "$DP_EXIT_DATAERR"
  dp__exec_safe_summary "$summary" || return "$DP_EXIT_DATAERR"
  content=$(printf 'field\tvalue\ncontract_version\t1\ntransaction_state\t%s\nplan_digest\t%s\nlast_completed_sequence\t%s\nstep_id\t%s\nstep_status\t%s\nsafe_summary\t%s' "$state" "$digest" "$sequence" "$step" "$step_status" "$summary")
  dp__exec_atomic_write "$root" transaction-journal.tsv "$content" 0600
}

dp__exec_read_journal() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local file=$1 output_name=$2 line key value line_number=0
  local -a expected=(contract_version transaction_state plan_digest last_completed_sequence step_id step_status safe_summary)
  local -A parsed=()
  dp__exec_is_assoc "$output_name" || return "$DP_EXIT_USAGE"
  [[ -f $file && ! -L $file && -r $file ]] || return "$DP_EXIT_NOINPUT"
  while IFS= read -r line || [[ -n $line ]]; do
    line_number=$((line_number + 1))
    if ((line_number == 1)); then [[ $line == $'field\tvalue' ]] || return "$DP_EXIT_DATAERR"; continue; fi
    [[ $line == *$'\t'* && $line != *$'\t'*$'\t'* ]] || return "$DP_EXIT_DATAERR"
    key=${line%%$'\t'*}; value=${line#*$'\t'}
    [[ $key == "${expected[$((line_number - 2))]-}" ]] || return "$DP_EXIT_DATAERR"
    parsed[$key]=$value
  done < "$file"
  ((line_number == 8)) || return "$DP_EXIT_DATAERR"
  [[ ${parsed[contract_version]} == 1 && ${parsed[transaction_state]} =~ ^(initialized|applying|blocked|failed|complete|recovery_required)$ && ${parsed[plan_digest]} =~ ^[0-9a-f]{64}$ && ${parsed[last_completed_sequence]} =~ ^([0-9]|10)$ && ${parsed[step_status]} =~ ^(pending|skipped|applied|unchanged|blocked|failed|verified)$ ]] || return "$DP_EXIT_DATAERR"
  dp__exec_safe_summary "${parsed[safe_summary]}" || return "$DP_EXIT_DATAERR"
  dp__exec_commit parsed "$output_name"
}

dp__exec_get_failure_point() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local root=$1 output_name=$2 file value allowed found=0
  dp__install_valid_variable_name "$output_name" || return "$DP_EXIT_USAGE"
  dp__exec_require_isolation_root "$root" || return
  file=$root/failure-point
  if [[ ! -e $file && ! -L $file ]]; then printf -v "$output_name" '%s' none; return 0; fi
  [[ -f $file && ! -L $file && -r $file ]] || return "$DP_EXIT_DATAERR"
  value=$(<"$file")
  for allowed in "${DP_EXEC_FAILURE_POINTS[@]}"; do [[ $value != "$allowed" ]] || found=1; done
  ((found == 1)) || return "$DP_EXIT_DATAERR"
  printf -v "$output_name" '%s' "$value"
}

dp__exec_fail_if_requested() {
  [[ $# -eq 4 ]] || return "$DP_EXIT_USAGE"
  local root=$1 point=$2 digest=$3 sequence=$4 configured
  dp__exec_get_failure_point "$root" configured || return
  [[ $configured != "$point" ]] || {
    if ((sequence > 0)); then dp__exec_write_journal "$root" recovery_required "$digest" "$sequence" "${DP_EXEC_STEP_IDS[$((sequence - 1))]}" failed 'injected isolated-test failure' || return; fi
    return "$DP_EXIT_TEMPFAIL"
  }
}

dp_exec_initialize_transaction() {
  [[ $# -eq 3 ]] || return "$DP_EXIT_USAGE"
  local root=$1 plan_name=$2 output_name=$3 point
  local -A existing=()
  dp__exec_is_assoc "$output_name" || return "$DP_EXIT_USAGE"
  dp__exec_require_isolation_root "$root" || return
  dp__exec_plan_valid "$plan_name" || return "$DP_EXIT_DATAERR"
  local -n plan_ref=$plan_name
  [[ ${plan_ref[PLAN_DIGEST]-} =~ ^[0-9a-f]{64}$ ]] || return "$DP_EXIT_DATAERR"
  if [[ -e $root/transaction-journal.tsv || -L $root/transaction-journal.tsv ]]; then
    if dp__exec_read_journal "$root/transaction-journal.tsv" existing && [[ ${existing[plan_digest]} == "${plan_ref[PLAN_DIGEST]}" && ${existing[transaction_state]} == complete ]]; then
      dp__exec_result "$output_name" pass unchanged 'transaction is already complete'
    else
      dp__exec_result "$output_name" critical blocked 'previous transaction requires review'
    fi
    return 0
  fi
  if ! dp__exec_fail_if_requested "$root" before_initialize_transaction "${plan_ref[PLAN_DIGEST]}" 0; then
    dp__exec_result "$output_name" critical failed 'failure injected before transaction initialization'
    return 0
  fi
  dp__exec_write_journal "$root" initialized "${plan_ref[PLAN_DIGEST]}" 3 initialize_transaction applied 'transaction initialized in isolation' || return
  if ! dp__exec_fail_if_requested "$root" after_initialize_transaction "${plan_ref[PLAN_DIGEST]}" 3; then
    dp__exec_result "$output_name" critical failed 'failure injected after transaction initialization'
  else
    dp__exec_result "$output_name" pass applied 'transaction initialized in isolation'
  fi
}

dp__exec_read_package_state() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local file=$1 output_name=$2 line line_number=0 index=0 package version requirement source_state trust_state install_state desired_version
  local -a fields=()
  local -A parsed=() seen=()
  dp__exec_is_assoc "$output_name" || return "$DP_EXIT_USAGE"
  [[ -f $file && ! -L $file && -r $file ]] || return "$DP_EXIT_NOINPUT"
  while IFS= read -r line || [[ -n $line ]]; do
    line_number=$((line_number + 1))
    IFS=$'\t' read -r -a fields <<< "$line"
    if ((line_number == 1)); then [[ $line == $'package\tversion\trequirement\tsource_state\tsigning_key_state\tinstall_state\tdesired_version' ]] || return "$DP_EXIT_DATAERR"; continue; fi
    ((${#fields[@]} == 7)) || return "$DP_EXIT_DATAERR"
    package=${fields[0]}; version=${fields[1]}; requirement=${fields[2]}; source_state=${fields[3]}; trust_state=${fields[4]}; install_state=${fields[5]}; desired_version=${fields[6]}
    [[ $package =~ ^[a-z0-9][a-z0-9+.-]*$ && ! -v seen[$package] ]] || return "$DP_EXIT_DATAERR"
    [[ ($version == none || $version =~ ^[0-9][A-Za-z0-9.+:~_-]{0,63}$) && ${version,,} != latest && $desired_version =~ ^[0-9][A-Za-z0-9.+:~_-]{0,63}$ && ${desired_version,,} != latest ]] || return "$DP_EXIT_DATAERR"
    [[ $requirement == required || $requirement == optional ]] || return "$DP_EXIT_DATAERR"
    [[ $source_state == resolved || $source_state == unresolved ]] || return "$DP_EXIT_DATAERR"
    [[ $trust_state == trusted || $trust_state == untrusted ]] || return "$DP_EXIT_DATAERR"
    [[ $install_state == installed || $install_state == absent || $install_state == partial || $install_state == version-conflict ]] || return "$DP_EXIT_DATAERR"
    seen[$package]=1
    parsed["PACKAGE.$index"]=$package; parsed["VERSION.$index"]=$version; parsed["REQUIREMENT.$index"]=$requirement
    parsed["SOURCE.$index"]=$source_state; parsed["TRUST.$index"]=$trust_state; parsed["STATE.$index"]=$install_state; parsed["DESIRED.$index"]=$desired_version
    index=$((index + 1))
  done < "$file"
  ((index > 0)) || return "$DP_EXIT_DATAERR"
  parsed[COUNT]=$index
  dp__exec_commit parsed "$output_name"
}

dp_exec_apply_simulated_packages() {
  [[ $# -eq 3 ]] || return "$DP_EXIT_USAGE"
  local root=$1 plan_name=$2 output_name=$3 desired_index state_index package desired_version requirement found changed=0 optional_skipped=0 content
  local -A desired=() state=()
  dp__exec_is_assoc "$output_name" || return "$DP_EXIT_USAGE"
  dp__exec_require_isolation_root "$root" || return
  dp__exec_plan_valid "$plan_name" || return "$DP_EXIT_DATAERR"
  local -n plan_ref=$plan_name
  dp__exec_parse_desired_packages "${plan_ref[DESIRED_AFTER.3]}" desired || return
  if ! dp__exec_read_package_state "$root/package-input.tsv" state; then dp__exec_result "$output_name" critical blocked 'simulated package input is missing or malformed'; return 0; fi
  content=$'package\tversion\trequirement\tsource_state\tsigning_key_state\tinstall_state\tdesired_version'
  for ((desired_index=0; desired_index<${desired[COUNT]}; desired_index++)); do
    package=${desired["PACKAGE.$desired_index"]}; desired_version=${desired["VERSION.$desired_index"]}; requirement=${desired["REQUIREMENT.$desired_index"]}; found=-1
    for ((state_index=0; state_index<${state[COUNT]}; state_index++)); do [[ ${state["PACKAGE.$state_index"]} != "$package" ]] || found=$state_index; done
    if ((found < 0)); then
      if [[ $requirement == optional ]]; then optional_skipped=$((optional_skipped + 1)); continue; fi
      changed=1
      content+=$(printf '\n%s\t%s\t%s\tresolved\ttrusted\tinstalled\t%s' "$package" "$desired_version" "$requirement" "$desired_version")
      continue
    fi
    if [[ ${state["REQUIREMENT.$found"]} != "$requirement" ]]; then dp__exec_result "$output_name" critical blocked 'simulated package requirement conflicts with plan'; return 0; fi
    if [[ ${state["SOURCE.$found"]} != resolved || ${state["TRUST.$found"]} != trusted ]]; then
      if [[ $requirement == optional ]]; then optional_skipped=$((optional_skipped + 1)); continue; fi
      dp__exec_result "$output_name" critical blocked 'required package source or signing-key trust is unresolved'; return 0
    fi
    case ${state["STATE.$found"]} in
      installed)
        if [[ ${state["VERSION.$found"]} != "$desired_version" ]]; then
          if [[ $requirement == optional ]]; then optional_skipped=$((optional_skipped + 1)); continue; fi
          dp__exec_result "$output_name" critical blocked 'required package version conflicts with immutable plan'; return 0
        fi
        ;;
      absent) changed=1 ;;
      partial|version-conflict)
        if [[ $requirement == optional ]]; then optional_skipped=$((optional_skipped + 1)); continue; fi
        dp__exec_result "$output_name" critical blocked 'required package state is partial or incompatible'; return 0
        ;;
    esac
    content+=$(printf '\n%s\t%s\t%s\tresolved\ttrusted\tinstalled\t%s' "$package" "$desired_version" "$requirement" "$desired_version")
  done
  dp__exec_atomic_write "$root" package-state.tsv "$content" 0600 || return
  dp__exec_write_journal "$root" applying "${plan_ref[PLAN_DIGEST]}" 4 apply_package_state "$([[ $changed -eq 1 ]] && printf applied || printf unchanged)" 'simulated package state applied' || return
  if ! dp__exec_fail_if_requested "$root" after_package_state "${plan_ref[PLAN_DIGEST]}" 4; then
    dp__exec_result "$output_name" critical failed 'failure injected after simulated package state'
  elif ((optional_skipped > 0)); then
    dp__exec_result "$output_name" warning "$([[ $changed -eq 1 ]] && printf applied || printf unchanged)" 'required packages match; optional package simulation was skipped'
  else
    dp__exec_result "$output_name" pass "$([[ $changed -eq 1 ]] && printf applied || printf unchanged)" 'simulated package state matches immutable plan'
  fi
}

dp__exec_layout_mode() {
  [[ $# -eq 3 ]] || return "$DP_EXIT_USAGE"
  local layout_name=$1 logical=$2 output_name=$3 index
  dp__install_valid_variable_name "$output_name" || return "$DP_EXIT_USAGE"
  local -n layout_ref=$layout_name
  for ((index=0; index<${layout_ref[COUNT]}; index++)); do
    if [[ ${layout_ref["PATH.$index"]} == "$logical" ]]; then printf -v "$output_name" '%s' "${layout_ref["MODE.$index"]}"; return 0; fi
  done
  return "$DP_EXIT_DATAERR"
}

dp__exec_data_has_extra_child() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local data_root=$1 entry base allowed
  [[ -d $data_root && ! -L $data_root ]] || return 1
  while IFS= read -r -d '' entry; do
    base=${entry##*/}; allowed=0
    for child in projects backups logs secrets ssl scripts; do [[ $base != "$child" ]] || allowed=1; done
    ((allowed == 1)) || return 0
  done < <(find "$data_root" -mindepth 1 -maxdepth 1 -print0)
  return 1
}

dp_exec_apply_filesystem_layout() {
  [[ $# -eq 3 ]] || return "$DP_EXIT_USAGE"
  local root=$1 layout_name=$2 output_name=$3 logical physical mode child changed=0 point identity_content
  dp__exec_is_assoc "$output_name" || return "$DP_EXIT_USAGE"
  dp__exec_require_isolation_root "$root" || return
  dp__install_layout_contract_valid "$layout_name" || return "$DP_EXIT_DATAERR"
  local -A journal=()
  dp__exec_read_journal "$root/transaction-journal.tsv" journal || return "$DP_EXIT_DATAERR"
  dp_exec_translate_managed_path "$root" /data physical || return
  if [[ -L $physical || (-e $physical && ! -d $physical) ]]; then dp__exec_result "$output_name" critical blocked 'isolated data root conflicts with directory contract'; return 0; fi
  if [[ -d $physical ]] && dp__exec_data_has_extra_child "$physical"; then dp__exec_result "$output_name" critical blocked 'isolated data root contains an undocumented direct child'; return 0; fi
  identity_content=$'field\tvalue\npolicy_state\tpolicy_defined\nidentity_state\tmatches_policy\nownership_state\tunverified'
  dp__exec_atomic_write "$root" identity-policy.tsv "$identity_content" 0600 || return
  if ! dp__exec_fail_if_requested "$root" after_identity_policy "${journal[plan_digest]}" 5; then dp__exec_result "$output_name" critical failed 'failure injected after identity-policy simulation'; return 0; fi
  if [[ ! -d $physical ]]; then mkdir -- "$physical" || return "$DP_EXIT_CANTCREAT"; changed=1; fi
  if ! dp__exec_fail_if_requested "$root" after_data_root "${journal[plan_digest]}" 6; then dp__exec_result "$output_name" critical failed 'failure injected after isolated data-root creation'; return 0; fi
  for child in projects backups logs secrets ssl scripts; do
    logical=/data/$child
    dp_exec_translate_managed_path "$root" "$logical" physical || return
    if [[ -L $physical || (-e $physical && ! -d $physical) ]]; then dp__exec_result "$output_name" critical blocked 'isolated managed child conflicts with directory contract'; return 0; fi
    if [[ ! -d $physical ]]; then mkdir -- "$physical" || return "$DP_EXIT_CANTCREAT"; changed=1; fi
    point=after_each_data_child:$child
    if ! dp__exec_fail_if_requested "$root" "$point" "${journal[plan_digest]}" 6; then dp__exec_result "$output_name" critical failed 'failure injected after isolated managed-child creation'; return 0; fi
  done
  for logical in "${DP_INSTALL_LAYOUT_PATHS[@]}"; do
    dp_exec_translate_managed_path "$root" "$logical" physical || return
    dp__exec_layout_mode "$layout_name" "$logical" mode || return
    if [[ 0$(stat -c '%a' -- "$physical" 2>/dev/null) != "$mode" ]]; then chmod "$mode" -- "$physical" || return "$DP_EXIT_IOERR"; changed=1; fi
  done
  if ! dp__exec_fail_if_requested "$root" after_modes "${journal[plan_digest]}" 6; then dp__exec_result "$output_name" critical failed 'failure injected after isolated mode application'; return 0; fi
  dp__exec_write_journal "$root" applying "${journal[plan_digest]}" 6 apply_filesystem_layout "$([[ $changed -eq 1 ]] && printf applied || printf unchanged)" 'isolated filesystem layout applied' || return
  dp__exec_result "$output_name" pass "$([[ $changed -eq 1 ]] && printf applied || printf unchanged)" 'isolated filesystem layout matches contract'
}

dp__exec_postconditions_ok() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local root=$1 plan_name=$2 logical physical mode index desired_index found
  local -A package_state=() desired=()
  dp__exec_require_isolation_root "$root" || return
  dp__exec_plan_valid "$plan_name" || return "$DP_EXIT_DATAERR"
  local -n plan_ref=$plan_name
  [[ -f $root/identity-policy.tsv && ! -L $root/identity-policy.tsv && $(<"$root/identity-policy.tsv") == $'field\tvalue\npolicy_state\tpolicy_defined\nidentity_state\tmatches_policy\nownership_state\tunverified' ]] || return 1
  for logical in "${DP_INSTALL_LAYOUT_PATHS[@]}"; do
    dp_exec_translate_managed_path "$root" "$logical" physical || return 1
    [[ -d $physical && ! -L $physical ]] || return 1
    dp__install_expected_layout_record "$logical" owner group mode mutability || return 1
    [[ 0$(stat -c '%a' -- "$physical" 2>/dev/null) == "$mode" ]] || return 1
  done
  ! dp__exec_data_has_extra_child "$root/data" || return 1
  dp__exec_read_package_state "$root/package-state.tsv" package_state || return 1
  dp__exec_parse_desired_packages "${plan_ref[DESIRED_AFTER.3]}" desired || return 1
  for ((desired_index=0; desired_index<${desired[COUNT]}; desired_index++)); do
    [[ ${desired["REQUIREMENT.$desired_index"]} == required ]] || continue
    found=0
    for ((index=0; index<${package_state[COUNT]}; index++)); do
      if [[ ${package_state["PACKAGE.$index"]} == "${desired["PACKAGE.$desired_index"]}" && ${package_state["VERSION.$index"]} == "${desired["VERSION.$desired_index"]}" && ${package_state["STATE.$index"]} == installed && ${package_state["SOURCE.$index"]} == resolved && ${package_state["TRUST.$index"]} == trusted ]]; then found=1; fi
    done
    ((found == 1)) || return 1
  done
}

dp_exec_verify_postconditions() {
  [[ $# -eq 3 ]] || return "$DP_EXIT_USAGE"
  local root=$1 plan_name=$2 output_name=$3
  local -n plan_ref=$plan_name
  dp__exec_is_assoc "$output_name" || return "$DP_EXIT_USAGE"
  dp__exec_require_isolation_root "$root" || return
  dp__exec_plan_valid "$plan_name" || return "$DP_EXIT_DATAERR"
  if ! dp__exec_fail_if_requested "$root" before_postcondition_verification "${plan_ref[PLAN_DIGEST]}" 7; then dp__exec_result "$output_name" critical failed 'failure injected before postcondition verification'; return 0; fi
  if ! dp__exec_postconditions_ok "$root" "$plan_name"; then
    dp__exec_write_journal "$root" recovery_required "${plan_ref[PLAN_DIGEST]}" 7 verify_postconditions failed 'isolated postcondition verification failed' || return
    dp__exec_result "$output_name" critical failed 'isolated postcondition verification failed'
    return 0
  fi
  dp__exec_atomic_write "$root" postconditions.tsv $'field\tvalue\nverification_state\tverified' 0600 || return
  dp__exec_write_journal "$root" applying "${plan_ref[PLAN_DIGEST]}" 7 verify_postconditions verified 'isolated postconditions verified' || return
  if ! dp__exec_fail_if_requested "$root" after_postcondition_verification "${plan_ref[PLAN_DIGEST]}" 7; then dp__exec_result "$output_name" critical failed 'failure injected after postcondition verification'; else dp__exec_result "$output_name" pass verified 'isolated postconditions verified'; fi
}

dp__exec_build_report() {
  [[ $# -eq 5 ]] || return "$DP_EXIT_USAGE"
  local plan_name=$1 transaction_state=$2 overall=$3 recovery=$4 output_name=$5 index id status summary
  local -A report_result=()
  dp__exec_plan_valid "$plan_name" || return "$DP_EXIT_DATAERR"
  dp__exec_is_assoc "$output_name" || return "$DP_EXIT_USAGE"
  [[ $transaction_state =~ ^(initialized|applying|blocked|failed|complete|recovery_required)$ && $overall =~ ^(pass|warning|critical)$ && ($recovery == true || $recovery == false) ]] || return "$DP_EXIT_DATAERR"
  report_result[overall_status]=$overall; report_result[transaction_state]=$transaction_state; report_result[recovery_required]=$recovery
  for ((index=0; index<10; index++)); do
    id=${DP_EXEC_STEP_IDS[$index]}
    if [[ $overall == pass ]]; then
      case $id in validate_execution_context|validate_resolved_plan|verify_postconditions|evaluate_recovery_state|finalize_transaction) status=verified ;; *) status=applied ;; esac
      summary='isolated execution step completed'
    else
      status=skipped; summary='step not completed because recovery review is required'
    fi
    report_result["$id.status"]=$status; report_result["$id.summary"]=$summary
  done
  dp__exec_commit report_result "$output_name"
}

dp__exec_build_failure_report() {
  [[ $# -eq 5 ]] || return "$DP_EXIT_USAGE"
  local plan_name=$1 failed_sequence=$2 recovery=$3 summary=$4 output_name=$5 index id status transaction_state
  local -A report_result=()
  dp__exec_plan_valid "$plan_name" || return "$DP_EXIT_DATAERR"
  dp__exec_is_assoc "$output_name" || return "$DP_EXIT_USAGE"
  dp_require_uint_range "$failed_sequence" 1 10 sequence >/dev/null 2>&1 || return "$DP_EXIT_DATAERR"
  dp__exec_safe_summary "$summary" || return "$DP_EXIT_DATAERR"
  transaction_state=$([[ $recovery == true ]] && printf recovery_required || printf failed)
  report_result[overall_status]=critical; report_result[transaction_state]=$transaction_state; report_result[recovery_required]=$recovery
  for ((index=0; index<10; index++)); do
    id=${DP_EXEC_STEP_IDS[$index]}
    if ((index + 1 < failed_sequence)); then
      case $id in validate_execution_context|validate_resolved_plan|verify_postconditions) status=verified ;; *) status=applied ;; esac
      report_result["$id.summary"]='isolated execution step completed'
    elif ((index + 1 == failed_sequence)); then status=failed; report_result["$id.summary"]=$summary
    else status=skipped; report_result["$id.summary"]='step not attempted after critical failure'
    fi
    report_result["$id.status"]=$status
  done
  dp__exec_commit report_result "$output_name"
}

dp_exec_record_completion() {
  [[ $# -eq 3 ]] || return "$DP_EXIT_USAGE"
  local root=$1 plan_name=$2 output_name=$3 content
  local -A journal=()
  dp__exec_is_assoc "$output_name" || return "$DP_EXIT_USAGE"
  dp__exec_require_isolation_root "$root" || return
  dp__exec_plan_valid "$plan_name" || return "$DP_EXIT_DATAERR"
  local -n plan_ref=$plan_name
  if ! dp__exec_read_journal "$root/transaction-journal.tsv" journal || [[ ${journal[plan_digest]} != "${plan_ref[PLAN_DIGEST]}" || ${journal[last_completed_sequence]} != 7 || ${journal[step_status]} != verified || ! -f $root/postconditions.tsv || -L $root/postconditions.tsv ]]; then
    dp__exec_result "$output_name" critical blocked 'completion requires verified postconditions for the same plan'
    return 0
  fi
  if ! dp__exec_fail_if_requested "$root" before_completion_record "${plan_ref[PLAN_DIGEST]}" 8; then dp__exec_result "$output_name" critical failed 'failure injected before completion recording'; return 0; fi
  content=$(printf 'field\tvalue\ncontract_version\t1\nplan_digest\t%s\ncompletion_state\tcomplete' "${plan_ref[PLAN_DIGEST]}")
  dp__exec_atomic_write "$root" completion.tsv "$content" 0600 || return
  dp__exec_write_journal "$root" complete "${plan_ref[PLAN_DIGEST]}" 10 finalize_transaction verified 'isolated transaction complete' || return
  dp__exec_build_report "$plan_name" complete pass false "$output_name"
}

dp_exec_detect_partial_install() {
  [[ $# -eq 3 ]] || return "$DP_EXIT_USAGE"
  local root=$1 plan_name=$2 output_name=$3 artifacts=0
  local -A result=() journal=()
  dp__exec_is_assoc "$output_name" || return "$DP_EXIT_USAGE"
  dp__exec_require_isolation_root "$root" || return
  dp__exec_plan_valid "$plan_name" || return "$DP_EXIT_DATAERR"
  local -n plan_ref=$plan_name
  if [[ ! -e $root/transaction-journal.tsv && ! -L $root/transaction-journal.tsv ]]; then
    for entry in completion.tsv package-state.tsv identity-policy.tsv postconditions.tsv; do [[ ! -e $root/$entry && ! -L $root/$entry ]] || artifacts=1; done
    if ((artifacts == 0)) && [[ ! -e $root/data && ! -L $root/data ]]; then
      result[STATUS]=pass; result[DETECTED_STATE]=no_previous_transaction; result[SAFE_TO_RESUME]=true; result[MANUAL_REVIEW_REQUIRED]=false; result[SUMMARY]='no previous isolated transaction exists'
    else
      result[STATUS]=critical; result[DETECTED_STATE]=unknown_state; result[SAFE_TO_RESUME]=false; result[MANUAL_REVIEW_REQUIRED]=true; result[SUMMARY]='isolated state exists without a valid transaction journal'
    fi
  elif ! dp__exec_read_journal "$root/transaction-journal.tsv" journal; then
    result[STATUS]=critical; result[DETECTED_STATE]=malformed_journal; result[SAFE_TO_RESUME]=false; result[MANUAL_REVIEW_REQUIRED]=true; result[SUMMARY]='transaction journal is malformed or truncated'
  elif [[ ${journal[plan_digest]} != "${plan_ref[PLAN_DIGEST]}" ]]; then
    result[STATUS]=critical; result[DETECTED_STATE]=plan_mismatch; result[SAFE_TO_RESUME]=false; result[MANUAL_REVIEW_REQUIRED]=true; result[SUMMARY]='transaction belongs to a different immutable plan'
  elif [[ ${journal[transaction_state]} == complete ]]; then
    if [[ -f $root/completion.tsv && ! -L $root/completion.tsv ]] && dp__exec_postconditions_ok "$root" "$plan_name"; then
      result[STATUS]=pass; result[DETECTED_STATE]=complete; result[SAFE_TO_RESUME]=false; result[MANUAL_REVIEW_REQUIRED]=false; result[SUMMARY]='previous isolated transaction is complete'
    else
      result[STATUS]=critical; result[DETECTED_STATE]=invalid_completion; result[SAFE_TO_RESUME]=false; result[MANUAL_REVIEW_REQUIRED]=true; result[SUMMARY]='completion record exists without satisfied postconditions'
    fi
  elif [[ ${journal[transaction_state]} == initialized ]]; then
    result[STATUS]=critical; result[DETECTED_STATE]=initialized_unapplied; result[SAFE_TO_RESUME]=false; result[MANUAL_REVIEW_REQUIRED]=true; result[SUMMARY]='initialized transaction remains unapplied'
  else
    result[STATUS]=critical; result[DETECTED_STATE]=partial_install; result[SAFE_TO_RESUME]=false; result[MANUAL_REVIEW_REQUIRED]=true; result[SUMMARY]='partial isolated transaction requires manual review'
  fi
  dp__exec_commit result "$output_name"
}

dp_exec_build_recovery_plan() {
  [[ $# -eq 3 ]] || return "$DP_EXIT_USAGE"
  local root=$1 plan_name=$2 output_name=$3 index status
  local -A detected=() recovery_result=()
  dp__exec_is_assoc "$output_name" || return "$DP_EXIT_USAGE"
  dp_exec_detect_partial_install "$root" "$plan_name" detected || return
  recovery_result[overall_status]=${detected[STATUS]}; recovery_result[detected_state]=${detected[DETECTED_STATE]}; recovery_result[safe_to_resume]=${detected[SAFE_TO_RESUME]}; recovery_result[manual_review_required]=${detected[MANUAL_REVIEW_REQUIRED]}
  recovery_result[COUNT]=4
  local -a ids=(validate_existing_state compare_plan_identity preserve_partial_state require_manual_review)
  for ((index=0; index<4; index++)); do
    recovery_result["ID.$index"]=${ids[$index]}
    status=pass
    if [[ ${detected[STATUS]} == critical ]]; then
      case ${ids[$index]} in validate_existing_state|compare_plan_identity|require_manual_review) status=critical ;; preserve_partial_state) status=warning ;; esac
    elif [[ ${detected[STATUS]} == warning ]]; then status=warning; fi
    recovery_result["STATUS.$index"]=$status
    recovery_result["SUMMARY.$index"]='preserve isolated state and require separately authorized review'
  done
  dp__exec_commit recovery_result "$output_name"
}

dp__exec_validate_report() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local report_name=$1 id
  dp__exec_is_assoc "$report_name" || return "$DP_EXIT_USAGE"
  local -n report_ref=$report_name
  [[ ${report_ref[overall_status]-} =~ ^(pass|warning|critical)$ && ${report_ref[transaction_state]-} =~ ^(initialized|applying|blocked|failed|complete|recovery_required)$ && (${report_ref[recovery_required]-} == true || ${report_ref[recovery_required]-} == false) ]] || return "$DP_EXIT_DATAERR"
  for id in "${DP_EXEC_STEP_IDS[@]}"; do
    [[ ${report_ref["$id.status"]-} =~ ^(pending|skipped|applied|unchanged|blocked|failed|verified)$ ]] || return "$DP_EXIT_DATAERR"
    dp__exec_safe_summary "${report_ref["$id.summary"]-}" || return "$DP_EXIT_DATAERR"
  done
}

dp_exec_render_text() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local report_name=$1 id
  dp__exec_validate_report "$report_name" || return
  local -n report_ref=$report_name
  printf 'ZolexoraDeployment installer execution (DP-07)\nInstaller execution contract version: 1\nExecution mode: isolated-test\nOverall status: %s\nTransaction state: %s\nSteps:\n' "${report_ref[overall_status]^^}" "${report_ref[transaction_state]}"
  for id in "${DP_EXEC_STEP_IDS[@]}"; do printf -- '- %s: %s - %s\n' "$id" "${report_ref["$id.status"]^^}" "${report_ref["$id.summary"]}"; done
  printf 'Transaction complete: %s\nRecovery required: %s\nExecution was confined to a validated disposable test root.\nNo production installation or host /data modification was authorized.\n' "$([[ ${report_ref[transaction_state]} == complete ]] && printf true || printf false)" "${report_ref[recovery_required]}"
}

dp__exec_json_escape() {
  dp__diag_json_escape "$@"
}

dp_exec_render_json() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local report_name=$1 id comma= summary
  dp__exec_validate_report "$report_name" || return
  local -n report_ref=$report_name
  printf '{\n  "contract_version": "1",\n  "mode": "isolated-test",\n  "overall_status": "%s",\n  "transaction_state": "%s",\n  "steps": [\n' "${report_ref[overall_status]}" "${report_ref[transaction_state]}"
  for id in "${DP_EXEC_STEP_IDS[@]}"; do
    summary=$(dp__exec_json_escape "${report_ref["$id.summary"]}") || return
    printf '%s    {"id": "%s", "status": "%s", "summary": "%s"}' "$comma" "$id" "${report_ref["$id.status"]}" "$summary"
    comma=$',\n'
  done
  printf '\n  ],\n  "recovery_required": %s,\n  "production_apply_authorized": false,\n  "host_data_modified": false,\n  "host_packages_modified": false,\n  "production_ready": false\n}\n' "${report_ref[recovery_required]}"
}

dp_exec_status_exit() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  case $1 in pass) return 0 ;; warning) return 1 ;; critical) return 2 ;; *) return "$DP_EXIT_SOFTWARE" ;; esac
}

dp_exec_cleanup_test_root() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local root=$1 output_name=$2
  dp__exec_is_assoc "$output_name" || return "$DP_EXIT_USAGE"
  dp__exec_require_isolation_root "$root" || return
  dp_assert_safe_destructive_target "$root" /tmp || return "$DP_EXIT_NOPERM"
  rm -rf -- "$root" || return "$DP_EXIT_IOERR"
  dp__exec_result "$output_name" pass applied 'validated disposable isolation root removed'
}

dp__exec_execute_isolated() {
  [[ $# -eq 4 ]] || return "$DP_EXIT_USAGE"
  local root=$1 plan_name=$2 layout_name=$3 output_name=$4 package_warning=0 id
  local -A detected=() step=()
  dp__exec_is_assoc "$output_name" || return "$DP_EXIT_USAGE"
  dp_exec_detect_partial_install "$root" "$plan_name" detected || return
  if [[ ${detected[DETECTED_STATE]} == complete ]]; then
    dp__exec_build_report "$plan_name" complete pass false "$output_name"
    local -n repeated_ref=$output_name
    for id in initialize_transaction apply_package_state establish_service_identity_policy apply_filesystem_layout record_completion; do repeated_ref["$id.status"]=unchanged; repeated_ref["$id.summary"]='existing isolated state remained unchanged'; done
    return 0
  fi
  if [[ ${detected[DETECTED_STATE]} != no_previous_transaction ]]; then dp__exec_build_failure_report "$plan_name" 1 true 'existing isolated state requires recovery review' "$output_name"; return 0; fi
  dp_exec_initialize_transaction "$root" "$plan_name" step || return
  if [[ ${step[STATUS]} == critical ]]; then dp__exec_build_failure_report "$plan_name" 3 "$([[ -e $root/transaction-journal.tsv ]] && printf true || printf false)" "${step[SUMMARY]}" "$output_name"; return 0; fi
  dp_exec_apply_simulated_packages "$root" "$plan_name" step || return
  if [[ ${step[STATUS]} == critical ]]; then dp__exec_build_failure_report "$plan_name" 4 true "${step[SUMMARY]}" "$output_name"; return 0; fi
  [[ ${step[STATUS]} != warning ]] || package_warning=1
  dp_exec_apply_filesystem_layout "$root" "$layout_name" step || return
  if [[ ${step[STATUS]} == critical ]]; then dp__exec_build_failure_report "$plan_name" 6 true "${step[SUMMARY]}" "$output_name"; return 0; fi
  dp_exec_verify_postconditions "$root" "$plan_name" step || return
  if [[ ${step[STATUS]} == critical ]]; then dp__exec_build_failure_report "$plan_name" 7 true "${step[SUMMARY]}" "$output_name"; return 0; fi
  dp_exec_record_completion "$root" "$plan_name" step || return
  if [[ ${step[STATUS]-} == critical ]]; then dp__exec_build_failure_report "$plan_name" 8 true "${step[SUMMARY]}" "$output_name"; return 0; fi
  [[ ${step[overall_status]-} == pass ]] || return "$DP_EXIT_SOFTWARE"
  dp__exec_commit step "$output_name"
  if ((package_warning == 1)); then
    local -n warning_report_ref=$output_name
    warning_report_ref[overall_status]=warning
    warning_report_ref[apply_package_state.summary]='required packages match; optional package simulation was skipped'
  fi
}
