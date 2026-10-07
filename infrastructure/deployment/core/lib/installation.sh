#!/usr/bin/env bash

if [[ ${DP_INSTALLATION_SH_LOADED:-0} == 1 ]]; then
  return 0 2>/dev/null || exit 0
fi
readonly DP_INSTALLATION_SH_LOADED=1

readonly -a DP_INSTALL_LAYOUT_PATHS=(
  /data /data/projects /data/backups /data/logs /data/secrets /data/ssl /data/scripts
)
readonly -a DP_INSTALL_PACKAGE_CAPABILITIES=(
  shell-bash filesystem-core shell-awk shell-sed shell-grep locking nss-resolution
  socket-inspection service-manager time-sync ca-certificates git-client nginx
  docker-engine docker-cli container-runtime docker-buildx docker-compose-v2
)
readonly -a DP_INSTALL_PLAN_STEP_IDS=(
  host_diagnostics filesystem_contract filesystem_existing_state service_identity
  required_packages package_versions package_sources idempotency
  transaction_boundaries execution_authorization
)

dp__install_valid_variable_name() {
  [[ ${1-} =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]
}

dp__install_is_assoc() {
  dp__install_valid_variable_name "${1-}" && [[ $(declare -p "$1" 2>/dev/null) == 'declare -A '* ]]
}

dp__install_commit() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  [[ $(declare -p "$1" 2>/dev/null) == 'declare -A '* ]] || return "$DP_EXIT_USAGE"
  dp__install_is_assoc "$2" || return "$DP_EXIT_USAGE"
  local dp__install_key
  local -n dp__install_source_ref=$1
  local -n dp__install_destination_ref=$2
  dp__install_destination_ref=()
  for dp__install_key in "${!dp__install_source_ref[@]}"; do
    dp__install_destination_ref[$dp__install_key]=${dp__install_source_ref[$dp__install_key]}
  done
}

dp__install_safe_summary() {
  [[ $# -eq 1 && -n $1 && $1 != *[[:cntrl:]]* ]]
}

dp__install_manifest_file_ok() {
  [[ $# -eq 1 && -f $1 && -r $1 && ! -L $1 ]] || return "$DP_EXIT_NOINPUT"
  local dp__install_size
  dp__install_size=$(stat -c '%s' -- "$1" 2>/dev/null) || return "$DP_EXIT_IOERR"
  ((dp__install_size > 0 && dp__install_size <= 1048576)) || return "$DP_EXIT_DATAERR"
}

dp__install_layout_path_ok() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  [[ $1 == /data || $1 == /data/projects || $1 == /data/backups || $1 == /data/logs || $1 == /data/secrets || $1 == /data/ssl || $1 == /data/scripts ]] || return 1
  [[ $1 != *'//'* && $1 != *[[:cntrl:]]* && $1 != *[[:space:]'`$*?[]{};|&<>\']* ]] || return 1
  ! dp_path_contains_traversal "$1"
}

dp__install_expected_layout_record() {
  [[ $# -eq 5 ]] || return "$DP_EXIT_USAGE"
  local dp__install_path=$1 dp__install_owner_name=$2 dp__install_group_name=$3 dp__install_mode_name=$4 dp__install_mutability_name=$5
  dp__install_valid_variable_name "$dp__install_owner_name" || return "$DP_EXIT_DATAERR"
  dp__install_valid_variable_name "$dp__install_group_name" || return "$DP_EXIT_DATAERR"
  dp__install_valid_variable_name "$dp__install_mode_name" || return "$DP_EXIT_DATAERR"
  dp__install_valid_variable_name "$dp__install_mutability_name" || return "$DP_EXIT_DATAERR"
  case $dp__install_path in
    /data) printf -v "$dp__install_owner_name" administrator; printf -v "$dp__install_group_name" administrator; printf -v "$dp__install_mode_name" 0755; printf -v "$dp__install_mutability_name" managed-boundary ;;
    /data/projects) printf -v "$dp__install_owner_name" deployment-service; printf -v "$dp__install_group_name" deployment-service; printf -v "$dp__install_mode_name" 0750; printf -v "$dp__install_mutability_name" release-mutable ;;
    /data/backups|/data/logs) printf -v "$dp__install_owner_name" deployment-service; printf -v "$dp__install_group_name" deployment-service; printf -v "$dp__install_mode_name" 0750; printf -v "$dp__install_mutability_name" shared-mutable ;;
    /data/secrets|/data/ssl) printf -v "$dp__install_owner_name" deployment-service; printf -v "$dp__install_group_name" deployment-service; printf -v "$dp__install_mode_name" 0700; printf -v "$dp__install_mutability_name" restricted-mutable ;;
    /data/scripts) printf -v "$dp__install_owner_name" administrator; printf -v "$dp__install_group_name" administrator; printf -v "$dp__install_mode_name" 0755; printf -v "$dp__install_mutability_name" published-immutable ;;
    *) return "$DP_EXIT_DATAERR" ;;
  esac
}

dp__install_layout_contract_valid() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local dp__install_layout_name=$1 dp__install_index dp__install_path dp__install_expected_owner dp__install_expected_group dp__install_expected_mode dp__install_expected_mutability dp__install_found
  dp__install_is_assoc "$dp__install_layout_name" || return "$DP_EXIT_USAGE"
  local -n dp__install_layout_ref=$dp__install_layout_name
  [[ ${dp__install_layout_ref[COUNT]-} == 7 ]] || return 1
  for dp__install_path in "${DP_INSTALL_LAYOUT_PATHS[@]}"; do
    dp__install_found=0
    for ((dp__install_index=0; dp__install_index<7; dp__install_index++)); do
      [[ ${dp__install_layout_ref["PATH.$dp__install_index"]-} == "$dp__install_path" ]] || continue
      dp__install_found=$((dp__install_found + 1))
      dp__install_expected_layout_record "$dp__install_path" dp__install_expected_owner dp__install_expected_group dp__install_expected_mode dp__install_expected_mutability || return 1
      [[ ${dp__install_layout_ref["TYPE.$dp__install_index"]-} == directory ]] || return 1
      [[ ${dp__install_layout_ref["OWNER_ROLE.$dp__install_index"]-} == "$dp__install_expected_owner" ]] || return 1
      [[ ${dp__install_layout_ref["GROUP_ROLE.$dp__install_index"]-} == "$dp__install_expected_group" ]] || return 1
      [[ ${dp__install_layout_ref["MODE.$dp__install_index"]-} == "$dp__install_expected_mode" ]] || return 1
      [[ ${dp__install_layout_ref["MUTABILITY.$dp__install_index"]-} == "$dp__install_expected_mutability" ]] || return 1
      dp__install_safe_summary "${dp__install_layout_ref["PURPOSE.$dp__install_index"]-}" || return 1
    done
    ((dp__install_found == 1)) || return 1
  done
}

dp_install_read_filesystem_manifest() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local dp__install_file=$1 dp__install_output_name=$2 dp__install_line dp__install_line_number=0 dp__install_index=0
  local -a dp__install_fields=()
  local -A dp__install_parsed=() dp__install_seen=()
  dp__install_is_assoc "$dp__install_output_name" || return "$DP_EXIT_USAGE"
  dp__install_manifest_file_ok "$dp__install_file" || return
  while IFS= read -r dp__install_line || [[ -n $dp__install_line ]]; do
    dp__install_line_number=$((dp__install_line_number + 1))
    [[ $dp__install_line != *$'\r' ]] || dp__install_line=${dp__install_line%$'\r'}
    IFS=$'\t' read -r -a dp__install_fields <<< "$dp__install_line"
    if ((dp__install_line_number == 1)); then
      [[ $dp__install_line == $'path\ttype\towner_role\tgroup_role\tmode\tmutability\tpurpose' ]] || return "$DP_EXIT_DATAERR"
      continue
    fi
    ((${#dp__install_fields[@]} == 7)) || return "$DP_EXIT_DATAERR"
    dp__install_layout_path_ok "${dp__install_fields[0]}" || return "$DP_EXIT_DATAERR"
    [[ ! -v dp__install_seen["${dp__install_fields[0]}"] ]] || return "$DP_EXIT_DATAERR"
    [[ ${dp__install_fields[1]} == directory ]] || return "$DP_EXIT_DATAERR"
    [[ ${dp__install_fields[2]} == administrator || ${dp__install_fields[2]} == deployment-service ]] || return "$DP_EXIT_DATAERR"
    [[ ${dp__install_fields[3]} == administrator || ${dp__install_fields[3]} == deployment-service ]] || return "$DP_EXIT_DATAERR"
    [[ ${dp__install_fields[4]} =~ ^0[0-7]{3}$ ]] || return "$DP_EXIT_DATAERR"
    ((8#${dp__install_fields[4]} & 0002)) && return "$DP_EXIT_DATAERR"
    [[ ${dp__install_fields[5]} =~ ^(managed-boundary|release-mutable|shared-mutable|restricted-mutable|published-immutable)$ ]] || return "$DP_EXIT_DATAERR"
    dp__install_safe_summary "${dp__install_fields[6]}" || return "$DP_EXIT_DATAERR"
    dp__install_seen["${dp__install_fields[0]}"]=1
    dp__install_parsed["PATH.$dp__install_index"]=${dp__install_fields[0]}
    dp__install_parsed["TYPE.$dp__install_index"]=${dp__install_fields[1]}
    dp__install_parsed["OWNER_ROLE.$dp__install_index"]=${dp__install_fields[2]}
    dp__install_parsed["GROUP_ROLE.$dp__install_index"]=${dp__install_fields[3]}
    dp__install_parsed["MODE.$dp__install_index"]=${dp__install_fields[4]}
    dp__install_parsed["MUTABILITY.$dp__install_index"]=${dp__install_fields[5]}
    dp__install_parsed["PURPOSE.$dp__install_index"]=${dp__install_fields[6]}
    dp__install_index=$((dp__install_index + 1))
  done < "$dp__install_file"
  dp__install_parsed[COUNT]=$dp__install_index
  dp__install_layout_contract_valid dp__install_parsed || return "$DP_EXIT_DATAERR"
  dp__install_commit dp__install_parsed "$dp__install_output_name"
}

dp_install_validate_layout() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local dp__install_layout_name=$1 dp__install_output_name=$2
  local -A dp__install_result=()
  dp__install_is_assoc "$dp__install_output_name" || return "$DP_EXIT_USAGE"
  if dp__install_layout_contract_valid "$dp__install_layout_name"; then
    dp__install_result[STATUS]=pass
    dp__install_result[SUMMARY]='filesystem manifest exactly matches the seven-path contract'
  else
    dp__install_result[STATUS]=critical
    dp__install_result[SUMMARY]='filesystem manifest does not match the canonical contract'
  fi
  dp__install_commit dp__install_result "$dp__install_output_name"
}

dp__install_inspect_layout_at() {
  [[ $# -eq 3 ]] || return "$DP_EXIT_USAGE"
  local dp__install_layout_name=$1 dp__install_physical_root=$2 dp__install_output_name=$3 dp__install_index dp__install_desired dp__install_actual dp__install_mode dp__install_uid dp__install_gid
  local dp__install_missing=0 dp__install_present=0 dp__install_conflicts=0 dp__install_mode_differences=0 dp__install_owner_differences=0 dp__install_identity_unavailable=0
  local -A dp__install_result=()
  dp__install_is_assoc "$dp__install_layout_name" || return "$DP_EXIT_USAGE"
  dp__install_is_assoc "$dp__install_output_name" || return "$DP_EXIT_USAGE"
  [[ $dp__install_physical_root == /* && $dp__install_physical_root != / && $dp__install_physical_root != *[[:cntrl:]]* ]] || return "$DP_EXIT_DATAERR"
  local -n dp__install_layout_ref=$dp__install_layout_name
  if [[ ! -e $dp__install_physical_root && ! -L $dp__install_physical_root ]]; then
    dp__install_result[STATUS]=critical
    dp__install_result[SUMMARY]='managed filesystem root is not present'
    dp__install_result[STATE]=not_present
    dp__install_commit dp__install_result "$dp__install_output_name"
    return 0
  fi
  if [[ -L $dp__install_physical_root || ! -d $dp__install_physical_root ]]; then
    dp__install_result[STATUS]=critical
    dp__install_result[SUMMARY]='managed filesystem root conflicts with the directory contract'
    dp__install_result[STATE]=differs_from_policy
    dp__install_commit dp__install_result "$dp__install_output_name"
    return 0
  fi
  for ((dp__install_index=0; dp__install_index<${dp__install_layout_ref[COUNT]}; dp__install_index++)); do
    dp__install_desired=${dp__install_layout_ref["PATH.$dp__install_index"]}
    if [[ $dp__install_desired == /data ]]; then
      dp__install_actual=$dp__install_physical_root
    else
      dp__install_actual=$dp__install_physical_root/${dp__install_desired#/data/}
    fi
    dp_assert_safe_managed_path "$dp__install_actual" "$dp__install_physical_root" >/dev/null 2>&1 || { dp__install_conflicts=$((dp__install_conflicts + 1)); continue; }
    if [[ ! -e $dp__install_actual && ! -L $dp__install_actual ]]; then
      dp__install_missing=$((dp__install_missing + 1))
      continue
    fi
    if [[ -L $dp__install_actual || ! -d $dp__install_actual ]]; then
      dp__install_conflicts=$((dp__install_conflicts + 1))
      continue
    fi
    dp__install_present=$((dp__install_present + 1))
    dp__install_mode=$(stat -c '%a' -- "$dp__install_actual" 2>/dev/null) || { dp__install_conflicts=$((dp__install_conflicts + 1)); continue; }
    [[ 0$dp__install_mode == "${dp__install_layout_ref["MODE.$dp__install_index"]}" ]] || dp__install_mode_differences=$((dp__install_mode_differences + 1))
    if [[ ${dp__install_layout_ref["OWNER_ROLE.$dp__install_index"]} == administrator || ${dp__install_layout_ref["GROUP_ROLE.$dp__install_index"]} == administrator ]]; then
      dp__install_uid=$(stat -c '%u' -- "$dp__install_actual" 2>/dev/null) || { dp__install_conflicts=$((dp__install_conflicts + 1)); continue; }
      dp__install_gid=$(stat -c '%g' -- "$dp__install_actual" 2>/dev/null) || { dp__install_conflicts=$((dp__install_conflicts + 1)); continue; }
      [[ ${dp__install_layout_ref["OWNER_ROLE.$dp__install_index"]} != administrator || $dp__install_uid == 0 ]] || dp__install_owner_differences=$((dp__install_owner_differences + 1))
      [[ ${dp__install_layout_ref["GROUP_ROLE.$dp__install_index"]} != administrator || $dp__install_gid == 0 ]] || dp__install_owner_differences=$((dp__install_owner_differences + 1))
    fi
    if [[ ${dp__install_layout_ref["OWNER_ROLE.$dp__install_index"]} == deployment-service || ${dp__install_layout_ref["GROUP_ROLE.$dp__install_index"]} == deployment-service ]]; then
      dp__install_identity_unavailable=$((dp__install_identity_unavailable + 1))
    fi
  done
  dp__install_result[PRESENT_COUNT]=$dp__install_present
  dp__install_result[MISSING_COUNT]=$dp__install_missing
  dp__install_result[IDENTITY_STATE]=$([[ $dp__install_identity_unavailable -gt 0 ]] && printf identity_unavailable || printf matches_policy)
  if ((dp__install_conflicts > 0 || dp__install_mode_differences > 0 || dp__install_owner_differences > 0)); then
    dp__install_result[STATUS]=critical
    dp__install_result[SUMMARY]='existing managed paths conflict with type ownership or mode policy'
    dp__install_result[STATE]=differs_from_policy
  elif ((dp__install_missing > 0 && dp__install_present > 1)); then
    dp__install_result[STATUS]=critical
    dp__install_result[SUMMARY]='partial managed filesystem layout detected'
    dp__install_result[STATE]=differs_from_policy
  elif ((dp__install_missing > 0)); then
    dp__install_result[STATUS]=warning
    dp__install_result[SUMMARY]='managed child layout is not present'
    dp__install_result[STATE]=not_present
  elif ((dp__install_identity_unavailable > 0)); then
    dp__install_result[STATUS]=warning
    dp__install_result[SUMMARY]='path types and modes match but service ownership is unverified'
    dp__install_result[STATE]=unverified
  else
    dp__install_result[STATUS]=pass
    dp__install_result[SUMMARY]='existing managed filesystem state matches policy'
    dp__install_result[STATE]=matches_policy
  fi
  dp__install_commit dp__install_result "$dp__install_output_name"
}

dp_install_inspect_layout() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  dp__install_inspect_layout_at "$1" /data "$2"
}

dp__install_package_contract_valid() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local dp__install_packages_name=$1 dp__install_capability dp__install_index dp__install_found dp__install_package
  local -A dp__install_seen_capabilities=() dp__install_seen_packages=()
  dp__install_is_assoc "$dp__install_packages_name" || return "$DP_EXIT_USAGE"
  local -n dp__install_packages_ref=$dp__install_packages_name
  [[ ${dp__install_packages_ref[COUNT]-} == 18 ]] || return 1
  for ((dp__install_index=0; dp__install_index<18; dp__install_index++)); do
    dp__install_capability=${dp__install_packages_ref["CAPABILITY.$dp__install_index"]-}
    dp__install_package=${dp__install_packages_ref["PACKAGE.$dp__install_index"]-}
    dp_is_valid_identifier "$dp__install_capability" || return 1
    [[ $dp__install_package =~ ^[a-z0-9][a-z0-9+.-]*$ ]] || return 1
    [[ ${dp__install_packages_ref["REQUIREMENT.$dp__install_index"]-} == required || ${dp__install_packages_ref["REQUIREMENT.$dp__install_index"]-} == optional ]] || return 1
    [[ ${dp__install_packages_ref["VERSION_POLICY.$dp__install_index"]-} == exact-resolved-pin ]] || return 1
    [[ ${dp__install_packages_ref["SOURCE.$dp__install_index"]-} == ubuntu-archive || ${dp__install_packages_ref["SOURCE.$dp__install_index"]-} == unresolved-external ]] || return 1
    dp__install_safe_summary "${dp__install_packages_ref["REASON.$dp__install_index"]-}" || return 1
    [[ ! -v dp__install_seen_capabilities[$dp__install_capability] && ! -v dp__install_seen_packages[$dp__install_package] ]] || return 1
    dp__install_seen_capabilities[$dp__install_capability]=1
    dp__install_seen_packages[$dp__install_package]=1
  done
  for dp__install_capability in "${DP_INSTALL_PACKAGE_CAPABILITIES[@]}"; do
    dp__install_found=0
    for ((dp__install_index=0; dp__install_index<18; dp__install_index++)); do
      [[ ${dp__install_packages_ref["CAPABILITY.$dp__install_index"]-} == "$dp__install_capability" ]] && dp__install_found=$((dp__install_found + 1))
    done
    ((dp__install_found == 1)) || return 1
  done
}

dp_install_read_package_manifest() {
  [[ $# -eq 4 ]] || return "$DP_EXIT_USAGE"
  local dp__install_file=$1 dp__install_os_id=$2 dp__install_os_version=$3 dp__install_output_name=$4 dp__install_line dp__install_line_number=0 dp__install_index=0 dp__install_versions
  local -a dp__install_fields=()
  local -A dp__install_parsed=() dp__install_seen_capability=() dp__install_seen_package=()
  dp__install_is_assoc "$dp__install_output_name" || return "$DP_EXIT_USAGE"
  [[ $dp__install_os_id == ubuntu && ($dp__install_os_version == 24.04 || $dp__install_os_version == 26.04) ]] || return "$DP_EXIT_DATAERR"
  dp__install_manifest_file_ok "$dp__install_file" || return
  while IFS= read -r dp__install_line || [[ -n $dp__install_line ]]; do
    dp__install_line_number=$((dp__install_line_number + 1))
    [[ $dp__install_line != *$'\r' ]] || dp__install_line=${dp__install_line%$'\r'}
    IFS=$'\t' read -r -a dp__install_fields <<< "$dp__install_line"
    if ((dp__install_line_number == 1)); then
      [[ $dp__install_line == $'capability\tubuntu_versions\tpackage\trequirement\tversion_policy\tsource\treason' ]] || return "$DP_EXIT_DATAERR"
      continue
    fi
    ((${#dp__install_fields[@]} == 7)) || return "$DP_EXIT_DATAERR"
    dp_is_valid_identifier "${dp__install_fields[0]}" || return "$DP_EXIT_DATAERR"
    [[ ${dp__install_fields[1]} == 24.04,26.04 ]] || return "$DP_EXIT_DATAERR"
    [[ ${dp__install_fields[2]} =~ ^[a-z0-9][a-z0-9+.-]*$ ]] || return "$DP_EXIT_DATAERR"
    [[ ${dp__install_fields[3]} == required || ${dp__install_fields[3]} == optional ]] || return "$DP_EXIT_DATAERR"
    [[ ${dp__install_fields[4]} == exact-resolved-pin ]] || return "$DP_EXIT_DATAERR"
    [[ ${dp__install_fields[5]} == ubuntu-archive || ${dp__install_fields[5]} == unresolved-external ]] || return "$DP_EXIT_DATAERR"
    dp__install_safe_summary "${dp__install_fields[6]}" || return "$DP_EXIT_DATAERR"
    [[ ! -v dp__install_seen_capability["${dp__install_fields[0]}"] && ! -v dp__install_seen_package["${dp__install_fields[2]}"] ]] || return "$DP_EXIT_DATAERR"
    dp__install_versions=${dp__install_fields[1]}
    [[ ,$dp__install_versions, == *,$dp__install_os_version,* ]] || continue
    dp__install_seen_capability["${dp__install_fields[0]}"]=1
    dp__install_seen_package["${dp__install_fields[2]}"]=1
    dp__install_parsed["CAPABILITY.$dp__install_index"]=${dp__install_fields[0]}
    dp__install_parsed["PACKAGE.$dp__install_index"]=${dp__install_fields[2]}
    dp__install_parsed["REQUIREMENT.$dp__install_index"]=${dp__install_fields[3]}
    dp__install_parsed["VERSION_POLICY.$dp__install_index"]=${dp__install_fields[4]}
    dp__install_parsed["SOURCE.$dp__install_index"]=${dp__install_fields[5]}
    dp__install_parsed["REASON.$dp__install_index"]=${dp__install_fields[6]}
    dp__install_index=$((dp__install_index + 1))
  done < "$dp__install_file"
  dp__install_parsed[COUNT]=$dp__install_index
  dp__install_package_contract_valid dp__install_parsed || return "$DP_EXIT_DATAERR"
  dp__install_commit dp__install_parsed "$dp__install_output_name"
}

dp_install_parse_dpkg_status() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local dp__install_text=$1 dp__install_output_name=$2 dp__install_line dp__install_index=0 dp__install_package dp__install_rest dp__install_version dp__install_state
  local -A dp__install_parsed=() dp__install_seen=()
  dp__install_is_assoc "$dp__install_output_name" || return "$DP_EXIT_USAGE"
  while IFS= read -r dp__install_line || [[ -n $dp__install_line ]]; do
    [[ -n $dp__install_line ]] || continue
    [[ $dp__install_line == *$'\t'*$'\t'* && $dp__install_line != *$'\t'*$'\t'*$'\t'* ]] || return "$DP_EXIT_DATAERR"
    dp__install_package=${dp__install_line%%$'\t'*}
    dp__install_rest=${dp__install_line#*$'\t'}
    dp__install_version=${dp__install_rest%%$'\t'*}
    dp__install_state=${dp__install_rest#*$'\t'}
    [[ $dp__install_package =~ ^[a-z0-9][a-z0-9+.-]*(:[a-z0-9]+)?$ ]] || return "$DP_EXIT_DATAERR"
    [[ -z $dp__install_version || $dp__install_version =~ ^[A-Za-z0-9.+:~_-]+$ ]] || return "$DP_EXIT_DATAERR"
    [[ $dp__install_state =~ ^[a-z][a-z[:space:]-]*$ ]] || return "$DP_EXIT_DATAERR"
    [[ ! -v dp__install_seen[$dp__install_package] ]] || return "$DP_EXIT_DATAERR"
    dp__install_seen[$dp__install_package]=1
    dp__install_parsed["PACKAGE.$dp__install_index"]=${dp__install_package%%:*}
    dp__install_parsed["VERSION.$dp__install_index"]=$dp__install_version
    if [[ $dp__install_state == 'install ok installed' && -n $dp__install_version ]]; then
      dp__install_parsed["STATE.$dp__install_index"]=installed
    elif [[ $dp__install_state == *not-installed ]]; then
      dp__install_parsed["STATE.$dp__install_index"]=absent
    else
      dp__install_parsed["STATE.$dp__install_index"]=partial
    fi
    dp__install_index=$((dp__install_index + 1))
  done <<< "$dp__install_text"
  dp__install_parsed[COUNT]=$dp__install_index
  dp__install_commit dp__install_parsed "$dp__install_output_name"
}

dp_install_inventory_packages() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local dp__install_packages_name=$1 dp__install_output_name=$2 dp__install_index dp__install_installed_index dp__install_package dp__install_requirement dp__install_raw= dp__install_query_status=0 dp__install_found dp__install_required_missing=0 dp__install_required_partial=0 dp__install_optional_missing=0 dp__install_optional_partial=0 dp__install_unresolved_sources=0
  local -a dp__install_names=()
  local -A dp__install_installed=() dp__install_result=()
  dp__install_is_assoc "$dp__install_packages_name" || return "$DP_EXIT_USAGE"
  dp__install_is_assoc "$dp__install_output_name" || return "$DP_EXIT_USAGE"
  local -n dp__install_packages_ref=$dp__install_packages_name
  dp__install_package_contract_valid "$dp__install_packages_name" || return "$DP_EXIT_DATAERR"
  for ((dp__install_index=0; dp__install_index<${dp__install_packages_ref[COUNT]}; dp__install_index++)); do
    dp__install_names+=("${dp__install_packages_ref["PACKAGE.$dp__install_index"]}")
    [[ ${dp__install_packages_ref["SOURCE.$dp__install_index"]} != unresolved-external || ${dp__install_packages_ref["REQUIREMENT.$dp__install_index"]} != required ]] || dp__install_unresolved_sources=$((dp__install_unresolved_sources + 1))
  done
  if ! dp_command_exists dpkg-query; then
    dp__install_result[REQUIRED_STATUS]=critical
    dp__install_result[REQUIRED_SUMMARY]='local package inventory capability is unavailable'
  else
    dp__install_raw=$(dpkg-query -W -f='${binary:Package}\t${Version}\t${Status}\n' -- "${dp__install_names[@]}" 2>/dev/null) || dp__install_query_status=$?
    if ! dp_install_parse_dpkg_status "$dp__install_raw" dp__install_installed; then
      dp__install_result[REQUIRED_STATUS]=critical
      dp__install_result[REQUIRED_SUMMARY]='local package inventory is malformed'
    else
      for ((dp__install_index=0; dp__install_index<${dp__install_packages_ref[COUNT]}; dp__install_index++)); do
        dp__install_package=${dp__install_packages_ref["PACKAGE.$dp__install_index"]}
        dp__install_requirement=${dp__install_packages_ref["REQUIREMENT.$dp__install_index"]}
        dp__install_found=0
        for ((dp__install_installed_index=0; dp__install_installed_index<${dp__install_installed[COUNT]}; dp__install_installed_index++)); do
          [[ ${dp__install_installed["PACKAGE.$dp__install_installed_index"]} == "$dp__install_package" ]] || continue
          dp__install_found=1
          if [[ ${dp__install_installed["STATE.$dp__install_installed_index"]} == absent ]]; then
            dp__install_found=0
          elif [[ ${dp__install_installed["STATE.$dp__install_installed_index"]} != installed ]]; then
            if [[ $dp__install_requirement == required ]]; then
              dp__install_required_partial=$((dp__install_required_partial + 1))
            else
              dp__install_optional_partial=$((dp__install_optional_partial + 1))
            fi
          fi
        done
        if ((dp__install_found == 0)); then
          if [[ $dp__install_requirement == required ]]; then
            dp__install_required_missing=$((dp__install_required_missing + 1))
          else
            dp__install_optional_missing=$((dp__install_optional_missing + 1))
          fi
        fi
      done
      if ((dp__install_required_missing > 0 || dp__install_required_partial > 0)); then
        dp__install_result[REQUIRED_STATUS]=critical
        dp__install_result[REQUIRED_SUMMARY]="$dp__install_required_missing required package(s) missing and $dp__install_required_partial partially installed"
      else
        dp__install_result[REQUIRED_STATUS]=pass
        dp__install_result[REQUIRED_SUMMARY]='all required packages are locally installed'
      fi
      dp__install_result[OPTIONAL_MISSING_COUNT]=$dp__install_optional_missing
      dp__install_result[OPTIONAL_PARTIAL_COUNT]=$dp__install_optional_partial
    fi
  fi
  dp__install_result[QUERY_STATUS]=$dp__install_query_status
  dp__install_result[VERSION_STATUS]=critical
  dp__install_result[VERSION_SUMMARY]='exact package versions and approved major versions remain unresolved'
  if ((dp__install_unresolved_sources > 0)); then
    dp__install_result[SOURCE_STATUS]=critical
    dp__install_result[SOURCE_SUMMARY]='Docker package source identity and signing key remain unresolved'
  else
    dp__install_result[SOURCE_STATUS]=pass
    dp__install_result[SOURCE_SUMMARY]='all package source classifications are resolved'
  fi
  dp__install_result[COMPOSE_STATUS]=pass
  dp__install_result[COMPOSE_SUMMARY]='Docker Compose v2 plugin is required; legacy Compose is not accepted'
  dp__install_commit dp__install_result "$dp__install_output_name"
}

dp__install_set_step() {
  [[ $# -eq 4 ]] || return "$DP_EXIT_USAGE"
  local dp__install_output_name=$1 dp__install_id=$2 dp__install_status=$3 dp__install_summary=$4 dp__install_known=0 dp__install_expected
  dp__install_is_assoc "$dp__install_output_name" || return "$DP_EXIT_USAGE"
  for dp__install_expected in "${DP_INSTALL_PLAN_STEP_IDS[@]}"; do [[ $dp__install_id != "$dp__install_expected" ]] || dp__install_known=1; done
  ((dp__install_known == 1)) || return "$DP_EXIT_DATAERR"
  [[ $dp__install_status == pass || $dp__install_status == warning || $dp__install_status == critical ]] || return "$DP_EXIT_DATAERR"
  dp__install_safe_summary "$dp__install_summary" || return "$DP_EXIT_DATAERR"
  local -n dp__install_step_ref=$dp__install_output_name
  dp__install_step_ref["$dp__install_id.status"]=$dp__install_status
  dp__install_step_ref["$dp__install_id.summary"]=$dp__install_summary
}

dp_install_build_plan() {
  [[ $# -eq 4 ]] || return "$DP_EXIT_USAGE"
  local dp__install_diagnostics_name=$1 dp__install_layout_name=$2 dp__install_packages_name=$3 dp__install_output_name=$4 dp__install_id dp__install_overall
  local -a dp__install_statuses=()
  local -A dp__install_plan=()
  dp__install_is_assoc "$dp__install_diagnostics_name" || return "$DP_EXIT_USAGE"
  dp__install_is_assoc "$dp__install_layout_name" || return "$DP_EXIT_USAGE"
  dp__install_is_assoc "$dp__install_packages_name" || return "$DP_EXIT_USAGE"
  dp__install_is_assoc "$dp__install_output_name" || return "$DP_EXIT_USAGE"
  dp__diag_validate_results "$dp__install_diagnostics_name" || return "$DP_EXIT_DATAERR"
  local -n dp__install_diagnostics_ref=$dp__install_diagnostics_name
  local -n dp__install_layout_ref=$dp__install_layout_name
  local -n dp__install_packages_ref=$dp__install_packages_name
  local dp__install_required_key
  for dp__install_required_key in CONTRACT_STATUS CONTRACT_SUMMARY EXISTING_STATUS EXISTING_SUMMARY; do
    [[ -v dp__install_layout_ref[$dp__install_required_key] ]] || return "$DP_EXIT_DATAERR"
  done
  for dp__install_required_key in REQUIRED_STATUS REQUIRED_SUMMARY VERSION_STATUS VERSION_SUMMARY SOURCE_STATUS SOURCE_SUMMARY; do
    [[ -v dp__install_packages_ref[$dp__install_required_key] ]] || return "$DP_EXIT_DATAERR"
  done
  dp__install_set_step dp__install_plan host_diagnostics "${dp__install_diagnostics_ref[overall_status]}" 'DP-05 host diagnostics completed read-only'
  dp__install_set_step dp__install_plan filesystem_contract "${dp__install_layout_ref[CONTRACT_STATUS]}" "${dp__install_layout_ref[CONTRACT_SUMMARY]}"
  dp__install_set_step dp__install_plan filesystem_existing_state "${dp__install_layout_ref[EXISTING_STATUS]}" "${dp__install_layout_ref[EXISTING_SUMMARY]}"
  dp__install_set_step dp__install_plan service_identity critical 'deployment service identity is unresolved and was not created'
  dp__install_set_step dp__install_plan required_packages "${dp__install_packages_ref[REQUIRED_STATUS]}" "${dp__install_packages_ref[REQUIRED_SUMMARY]}"
  dp__install_set_step dp__install_plan package_versions "${dp__install_packages_ref[VERSION_STATUS]}" "${dp__install_packages_ref[VERSION_SUMMARY]}"
  dp__install_set_step dp__install_plan package_sources "${dp__install_packages_ref[SOURCE_STATUS]}" "${dp__install_packages_ref[SOURCE_SUMMARY]}"
  if [[ ${dp__install_layout_ref[CONTRACT_STATUS]} == pass ]]; then
    dp__install_set_step dp__install_plan idempotency pass 'same inspected state produces the same immutable dry-run plan'
  else
    dp__install_set_step dp__install_plan idempotency critical 'idempotency cannot be established for an invalid contract'
  fi
  dp__install_set_step dp__install_plan transaction_boundaries pass 'all future mutation remains behind validated transaction boundaries'
  dp__install_set_step dp__install_plan execution_authorization pass 'applying this plan is not authorized in DP-06'
  for dp__install_id in "${DP_INSTALL_PLAN_STEP_IDS[@]}"; do dp__install_statuses+=("${dp__install_plan[$dp__install_id.status]}"); done
  dp__install_overall=$(dp__diag_worst_status "${dp__install_statuses[@]}") || return "$DP_EXIT_SOFTWARE"
  dp__install_plan[overall_status]=$dp__install_overall
  dp__install_commit dp__install_plan "$dp__install_output_name"
}

dp__install_validate_plan() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local dp__install_plan_name=$1 dp__install_id dp__install_expected
  local -a dp__install_statuses=()
  dp__install_is_assoc "$dp__install_plan_name" || return "$DP_EXIT_USAGE"
  local -n dp__install_plan_ref=$dp__install_plan_name
  for dp__install_id in "${DP_INSTALL_PLAN_STEP_IDS[@]}"; do
    [[ -v dp__install_plan_ref[$dp__install_id.status] && -v dp__install_plan_ref[$dp__install_id.summary] ]] || return "$DP_EXIT_DATAERR"
    [[ ${dp__install_plan_ref[$dp__install_id.status]} == pass || ${dp__install_plan_ref[$dp__install_id.status]} == warning || ${dp__install_plan_ref[$dp__install_id.status]} == critical ]] || return "$DP_EXIT_DATAERR"
    dp__install_safe_summary "${dp__install_plan_ref[$dp__install_id.summary]}" || return "$DP_EXIT_DATAERR"
    dp__install_statuses+=("${dp__install_plan_ref[$dp__install_id.status]}")
  done
  dp__install_expected=$(dp__diag_worst_status "${dp__install_statuses[@]}") || return "$DP_EXIT_DATAERR"
  [[ ${dp__install_plan_ref[overall_status]-} == "$dp__install_expected" ]]
}

dp_install_render_text() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local dp__install_plan_name=$1 dp__install_id
  dp__install_validate_plan "$dp__install_plan_name" || return "$DP_EXIT_DATAERR"
  local -n dp__install_text_ref=$dp__install_plan_name
  printf 'ZolexoraDeployment installation plan (DP-06)\nFilesystem contract version: 1\nInstallation plan contract version: 1\nOverall status: %s\nSteps:\n' "${dp__install_text_ref[overall_status]^^}"
  for dp__install_id in "${DP_INSTALL_PLAN_STEP_IDS[@]}"; do
    printf -- '- %s: %s - %s\n' "$dp__install_id" "${dp__install_text_ref[$dp__install_id.status]^^}" "${dp__install_text_ref[$dp__install_id.summary]}"
  done
  printf 'No installation or host modification was performed.\nThis plan does not authorize installation or certify production readiness.\n'
}

dp__install_json_escape() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local dp__install_value=$1
  dp__install_value=${dp__install_value//\\/\\\\}
  dp__install_value=${dp__install_value//\"/\\\"}
  dp__install_value=${dp__install_value//$'\b'/\\b}
  dp__install_value=${dp__install_value//$'\f'/\\f}
  dp__install_value=${dp__install_value//$'\n'/\\n}
  dp__install_value=${dp__install_value//$'\r'/\\r}
  dp__install_value=${dp__install_value//$'\t'/\\t}
  [[ $dp__install_value != *[[:cntrl:]]* ]] || return "$DP_EXIT_DATAERR"
  printf '%s' "$dp__install_value"
}

dp_install_render_json() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local dp__install_plan_name=$1 dp__install_id dp__install_comma= dp__install_summary
  dp__install_validate_plan "$dp__install_plan_name" || return "$DP_EXIT_DATAERR"
  local -n dp__install_json_ref=$dp__install_plan_name
  printf '{\n  "contract_version": "1",\n  "mode": "dry-run",\n  "overall_status": "%s",\n  "steps": [\n' "${dp__install_json_ref[overall_status]}"
  for dp__install_id in "${DP_INSTALL_PLAN_STEP_IDS[@]}"; do
    dp__install_summary=$(dp__install_json_escape "${dp__install_json_ref[$dp__install_id.summary]}") || return "$DP_EXIT_DATAERR"
    printf '%s    {"id": "%s", "status": "%s", "summary": "%s"}' "$dp__install_comma" "$dp__install_id" "${dp__install_json_ref[$dp__install_id.status]}" "$dp__install_summary"
    dp__install_comma=$',\n'
  done
  printf '\n  ],\n  "apply_authorized": false,\n  "host_modified": false,\n  "production_ready": false\n}\n'
}

dp_install_status_exit() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  case $1 in
    pass) return 0 ;;
    warning) return 1 ;;
    critical) return 2 ;;
    *) return "$DP_EXIT_SOFTWARE" ;;
  esac
}
