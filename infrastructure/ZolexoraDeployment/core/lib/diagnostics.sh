#!/usr/bin/env bash

if [[ ${DP_DIAGNOSTICS_SH_LOADED:-0} == 1 ]]; then
  return 0 2>/dev/null || exit 0
fi
readonly DP_DIAGNOSTICS_SH_LOADED=1

dp__diagnostics_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=runtime.sh
source "$dp__diagnostics_dir/runtime.sh"
# shellcheck source=validation.sh
source "$dp__diagnostics_dir/validation.sh"
# shellcheck source=paths.sh
source "$dp__diagnostics_dir/paths.sh"
unset dp__diagnostics_dir

readonly DP_DIAG_CONTRACT_VERSION=1
readonly -a DP_DIAG_CHECK_IDS=(
  operating_system required_commands capacity filesystem docker docker_compose
  nginx systemd listeners time_sync dns
)
readonly -a DP_DIAG_REQUIRED_COMMANDS=(
  bash awk sed grep date df stat realpath readlink dirname flock getent ss systemctl timedatectl
)

dp__diag_valid_variable_name() {
  [[ ${1-} =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]
}

dp__diag_is_associative_array() {
  dp__diag_valid_variable_name "${1-}" && [[ $(declare -p "$1" 2>/dev/null) == 'declare -A '* ]]
}

dp__diag_is_public_output_name() {
  dp__diag_valid_variable_name "${1-}" && [[ $1 != dp__* ]]
}

dp__diag_is_public_output_array() {
  dp__diag_is_public_output_name "${1-}" && dp__diag_is_associative_array "$1"
}

dp__diag_commit_array() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  dp__diag_is_associative_array "$1" || return "$DP_EXIT_USAGE"
  dp__diag_is_associative_array "$2" || return "$DP_EXIT_USAGE"
  local key
  local -n dp__diag_source_ref=$1
  local -n dp__diag_destination_ref=$2
  dp__diag_destination_ref=()
  for key in "${!dp__diag_source_ref[@]}"; do
    dp__diag_destination_ref[$key]=${dp__diag_source_ref[$key]}
  done
}

dp__diag_safe_text() {
  [[ $# -eq 1 && $1 != *[[:cntrl:]]* ]]
}

dp__diag_worst_status() {
  [[ $# -ge 1 ]] || return "$DP_EXIT_USAGE"
  local status worst=pass
  for status in "$@"; do
    case $status in
      critical) worst=critical ;;
      warning) [[ $worst == critical ]] || worst=warning ;;
      pass) ;;
      *) return "$DP_EXIT_DATAERR" ;;
    esac
  done
  printf '%s\n' "$worst"
}

dp__diag_set_result() {
  [[ $# -eq 4 ]] || return "$DP_EXIT_USAGE"
  local output_name=$1 id=$2 status=$3 summary=$4 known=0 expected
  dp__diag_is_public_output_array "$output_name" || return "$DP_EXIT_USAGE"
  for expected in "${DP_DIAG_CHECK_IDS[@]}"; do
    [[ $id != "$expected" ]] || known=1
  done
  ((known == 1)) || return "$DP_EXIT_DATAERR"
  [[ $status == pass || $status == warning || $status == critical ]] || return "$DP_EXIT_DATAERR"
  dp__diag_safe_text "$summary" || return "$DP_EXIT_DATAERR"
  local -n dp__diag_result_ref=$output_name
  dp__diag_result_ref["$id.status"]=$status
  dp__diag_result_ref["$id.summary"]=$summary
}

dp__diag_unquote_os_value() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local raw_value=$1 output_name=$2 first last
  dp__diag_valid_variable_name "$output_name" || return "$DP_EXIT_DATAERR"
  [[ $raw_value != *[[:cntrl:]]* && $raw_value != *'$('* && $raw_value != *'${'* && $raw_value != *'`'* ]] || return "$DP_EXIT_DATAERR"
  if ((${#raw_value} >= 2)); then
    first=${raw_value:0:1}
    last=${raw_value: -1}
    if [[ ($first == '"' && $last == '"') || ($first == "'" && $last == "'") ]]; then
      raw_value=${raw_value:1:${#raw_value}-2}
    elif [[ $first == '"' || $first == "'" || $last == '"' || $last == "'" ]]; then
      return "$DP_EXIT_DATAERR"
    fi
  fi
  [[ $raw_value != *'"'* && $raw_value != *"'"* && $raw_value != *'\\'* ]] || return "$DP_EXIT_DATAERR"
  printf -v "$output_name" '%s' "$raw_value"
}

dp_diag_read_os_release() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local file=$1 output_name=$2 resolved line key raw value
  local -A dp__diag_os_parsed=() dp__diag_os_seen=()
  dp__diag_is_public_output_array "$output_name" || return "$DP_EXIT_USAGE"
  [[ -e $file || -L $file ]] || return "$DP_EXIT_NOINPUT"
  resolved=$(readlink -f -- "$file" 2>/dev/null) || return "$DP_EXIT_DATAERR"
  [[ -f $resolved && -r $resolved ]] || return "$DP_EXIT_NOINPUT"

  while IFS= read -r line || [[ -n $line ]]; do
    [[ $line != *$'\r' ]] || line=${line%$'\r'}
    [[ -z $line || $line == \#* ]] && continue
    [[ $line =~ ^([A-Z][A-Z0-9_]*)=(.*)$ ]] || return "$DP_EXIT_DATAERR"
    key=${BASH_REMATCH[1]}
    raw=${BASH_REMATCH[2]}
    case $key in
      ID|VERSION_ID|PRETTY_NAME)
        [[ ! -v dp__diag_os_seen[$key] ]] || return "$DP_EXIT_DATAERR"
        dp__diag_unquote_os_value "$raw" value || return
        dp__diag_os_seen[$key]=1
        dp__diag_os_parsed[$key]=$value
        ;;
    esac
  done < "$resolved"

  [[ -v dp__diag_os_parsed[ID] && -v dp__diag_os_parsed[VERSION_ID] ]] || return "$DP_EXIT_DATAERR"
  [[ ${dp__diag_os_parsed[ID]} =~ ^[a-z0-9._-]+$ ]] || return "$DP_EXIT_DATAERR"
  [[ ${dp__diag_os_parsed[VERSION_ID]} =~ ^[0-9]+([.][0-9]+)*$ ]] || return "$DP_EXIT_DATAERR"
  if [[ -v dp__diag_os_parsed[PRETTY_NAME] ]]; then
    [[ ${dp__diag_os_parsed[PRETTY_NAME]} =~ ^[A-Za-z0-9][A-Za-z0-9._+()[:space:]-]{0,127}$ ]] || return "$DP_EXIT_DATAERR"
  fi
  dp__diag_commit_array dp__diag_os_parsed "$output_name"
}

dp_diag_read_cpu_count() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local file=$1 output_name=$2 dp__diag_cpu_line dp__diag_cpu_count=0
  dp__diag_is_public_output_name "$output_name" || return "$DP_EXIT_DATAERR"
  [[ -f $file && -r $file ]] || return "$DP_EXIT_NOINPUT"
  while IFS= read -r dp__diag_cpu_line || [[ -n $dp__diag_cpu_line ]]; do
    if [[ $dp__diag_cpu_line =~ ^processor[[:space:]]*: ]]; then
      [[ $dp__diag_cpu_line =~ ^processor[[:space:]]*:[[:space:]]*[0-9]+[[:space:]]*$ ]] || return "$DP_EXIT_DATAERR"
      ((dp__diag_cpu_count < 9223372036854775807)) || return "$DP_EXIT_DATAERR"
      dp__diag_cpu_count=$((dp__diag_cpu_count + 1))
    fi
  done < "$file"
  ((dp__diag_cpu_count > 0)) || return "$DP_EXIT_DATAERR"
  printf -v "$output_name" '%s' "$dp__diag_cpu_count"
}

dp_diag_read_memory_kib() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local file=$1 output_name=$2 dp__diag_memory_line dp__diag_memory_value= dp__diag_memory_found=0
  dp__diag_is_public_output_name "$output_name" || return "$DP_EXIT_DATAERR"
  [[ -f $file && -r $file ]] || return "$DP_EXIT_NOINPUT"
  while IFS= read -r dp__diag_memory_line || [[ -n $dp__diag_memory_line ]]; do
    if [[ $dp__diag_memory_line == MemTotal:* ]]; then
      ((dp__diag_memory_found == 0)) || return "$DP_EXIT_DATAERR"
      [[ $dp__diag_memory_line =~ ^MemTotal:[[:space:]]+([0-9]+)[[:space:]]+kB[[:space:]]*$ ]] || return "$DP_EXIT_DATAERR"
      dp__diag_memory_value=${BASH_REMATCH[1]}
      dp_is_valid_uint "$dp__diag_memory_value" || return "$DP_EXIT_DATAERR"
      dp__diag_memory_found=1
    fi
  done < "$file"
  ((dp__diag_memory_found == 1 && 10#$dp__diag_memory_value > 0)) || return "$DP_EXIT_DATAERR"
  printf -v "$output_name" '%s' "$((10#$dp__diag_memory_value))"
}

dp_diag_check_filesystem() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local root=$1 output_name=$2 mode permission_value child present=0 missing=0
  local -a children=(projects backups logs secrets ssl scripts)
  local -A dp__diag_fs_result=()
  dp__diag_is_public_output_array "$output_name" || return "$DP_EXIT_USAGE"

  if [[ -z $root || $root != /* || -L $root || ! -d $root ]]; then
    dp__diag_fs_result[STATUS]=critical
    dp__diag_fs_result[SUMMARY]='managed filesystem root is missing or unsafe'
    dp__diag_commit_array dp__diag_fs_result "$output_name"
    return 0
  fi
  dp_assert_safe_managed_path "$root" "$root" >/dev/null 2>&1 || {
    dp__diag_fs_result[STATUS]=critical
    dp__diag_fs_result[SUMMARY]='managed filesystem root cannot be safely resolved'
    dp__diag_commit_array dp__diag_fs_result "$output_name"
    return 0
  }
  mode=$(stat -c '%a' -- "$root" 2>/dev/null) || {
    dp__diag_fs_result[STATUS]=critical
    dp__diag_fs_result[SUMMARY]='managed filesystem permissions are unavailable'
    dp__diag_commit_array dp__diag_fs_result "$output_name"
    return 0
  }
  if [[ ! $mode =~ ^[0-7]{3,4}$ ]]; then
    dp__diag_fs_result[STATUS]=critical
    dp__diag_fs_result[SUMMARY]='managed filesystem permissions are malformed'
    dp__diag_commit_array dp__diag_fs_result "$output_name"
    return 0
  fi
  permission_value=$((8#$mode))
  if ((permission_value & 0002)) || [[ ! -r $root || ! -x $root ]] || ! ((permission_value & 0555)); then
    dp__diag_fs_result[STATUS]=critical
    dp__diag_fs_result[SUMMARY]='managed filesystem root permissions are unsafe'
    dp__diag_commit_array dp__diag_fs_result "$output_name"
    return 0
  fi

  for child in "${children[@]}"; do
    if [[ ! -e $root/$child && ! -L $root/$child ]]; then
      missing=$((missing + 1))
    elif [[ -L $root/$child || ! -d $root/$child ]] || ! dp_assert_safe_managed_path "$root/$child" "$root" >/dev/null 2>&1; then
      dp__diag_fs_result[STATUS]=critical
      dp__diag_fs_result[SUMMARY]='a documented managed directory is unsafe'
      dp__diag_commit_array dp__diag_fs_result "$output_name"
      return 0
    else
      present=$((present + 1))
    fi
  done
  dp__diag_fs_result[PRESENT_CHILDREN]=$present
  dp__diag_fs_result[MISSING_CHILDREN]=$missing
  if ((missing > 0)); then
    dp__diag_fs_result[STATUS]=warning
    dp__diag_fs_result[SUMMARY]="$present of 6 documented managed directories are present"
  else
    dp__diag_fs_result[STATUS]=pass
    dp__diag_fs_result[SUMMARY]='all 6 documented managed directories are present'
  fi
  dp__diag_commit_array dp__diag_fs_result "$output_name"
}

dp_diag_inventory_commands() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local output_name=$1 command required_missing=0 optional_missing=0
  local -A dp__diag_inventory_result=()
  dp__diag_is_public_output_array "$output_name" || return "$DP_EXIT_USAGE"
  for command in "${DP_DIAG_REQUIRED_COMMANDS[@]}"; do
    dp_command_exists "$command" || required_missing=$((required_missing + 1))
  done
  for command in docker nginx; do
    dp_command_exists "$command" || optional_missing=$((optional_missing + 1))
  done
  dp__diag_inventory_result[REQUIRED_MISSING]=$required_missing
  dp__diag_inventory_result[OPTIONAL_MISSING]=$optional_missing
  if ((required_missing > 0)); then
    dp__diag_inventory_result[STATUS]=critical
    dp__diag_inventory_result[SUMMARY]="$required_missing required diagnostic command(s) unavailable"
  elif ((optional_missing > 0)); then
    dp__diag_inventory_result[STATUS]=warning
    dp__diag_inventory_result[SUMMARY]="$optional_missing prerequisite client command(s) unavailable"
  else
    dp__diag_inventory_result[STATUS]=pass
    dp__diag_inventory_result[SUMMARY]='all required diagnostic commands are available'
  fi
  dp__diag_commit_array dp__diag_inventory_result "$output_name"
}

dp_diag_parse_listener_text() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local text=$1 output_name=$2 line protocol state local_address
  local tcp=0 udp=0 wildcard=0
  local -a fields=()
  local -A dp__diag_listener_result=()
  dp__diag_is_public_output_array "$output_name" || return "$DP_EXIT_USAGE"
  while IFS= read -r line || [[ -n $line ]]; do
    [[ -n $line ]] || continue
    read -r -a fields <<< "$line"
    ((${#fields[@]} >= 5)) || return "$DP_EXIT_DATAERR"
    protocol=${fields[0]}
    state=${fields[1]}
    local_address=${fields[4]}
    case $protocol in
      tcp|tcp6)
        [[ $state == LISTEN ]] || return "$DP_EXIT_DATAERR"
        tcp=$((tcp + 1))
        ;;
      udp|udp6)
        [[ $state == UNCONN ]] || return "$DP_EXIT_DATAERR"
        udp=$((udp + 1))
        ;;
      *) return "$DP_EXIT_DATAERR" ;;
    esac
    case $local_address in
      0.0.0.0:*|'[::]:'*|'*:'*) wildcard=$((wildcard + 1)) ;;
    esac
  done <<< "$text"
  dp__diag_listener_result[TCP_COUNT]=$tcp
  dp__diag_listener_result[UDP_COUNT]=$udp
  dp__diag_listener_result[WILDCARD_COUNT]=$wildcard
  dp__diag_commit_array dp__diag_listener_result "$output_name"
}

dp__diag_parse_df() {
  [[ $# -eq 3 ]] || return "$DP_EXIT_USAGE"
  local text=$1 total_name=$2 available_name=$3 line total= available=
  local -a fields=()
  dp__diag_valid_variable_name "$total_name" || return "$DP_EXIT_DATAERR"
  dp__diag_valid_variable_name "$available_name" || return "$DP_EXIT_DATAERR"
  while IFS= read -r line || [[ -n $line ]]; do
    [[ -n $line && $line != Filesystem* ]] || continue
    read -r -a fields <<< "$line"
    ((${#fields[@]} >= 6)) || return "$DP_EXIT_DATAERR"
    total=${fields[1]}
    available=${fields[3]}
  done <<< "$text"
  dp_is_valid_uint "$total" && dp_is_valid_uint "$available" || return "$DP_EXIT_DATAERR"
  printf -v "$total_name" '%s' "$((10#$total))"
  printf -v "$available_name" '%s' "$((10#$available))"
}

dp__diag_parse_docker_version() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  [[ $1 =~ Docker[[:space:]]version[[:space:]]([0-9]+([.][0-9]+){1,3}) ]] || return "$DP_EXIT_DATAERR"
  printf -v "$2" '%s' "${BASH_REMATCH[1]}"
}

dp__diag_parse_compose_version() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  [[ $1 =~ Docker[[:space:]]Compose[[:space:]]version[[:space:]]v?([0-9]+([.][0-9]+){1,3}) ]] || return "$DP_EXIT_DATAERR"
  printf -v "$2" '%s' "${BASH_REMATCH[1]}"
}

dp__diag_parse_nginx_version() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  [[ $1 =~ nginx[[:space:]]version:[[:space:]]nginx/([0-9]+([.][0-9]+){1,3}) ]] || return "$DP_EXIT_DATAERR"
  printf -v "$2" '%s' "${BASH_REMATCH[1]}"
}

dp__diag_parse_time_sync() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  [[ $1 == yes || $1 == no ]]
}

dp__diag_resolver_configured() {
  [[ $# -eq 1 && -f $1 && -r $1 ]] || return "$DP_EXIT_NOINPUT"
  local line value found=0
  while IFS= read -r line || [[ -n $line ]]; do
    [[ $line != *[[:cntrl:]]* ]] || return "$DP_EXIT_DATAERR"
    if [[ $line =~ ^[[:space:]]*nameserver[[:space:]]+([^[:space:]#]+)([[:space:]]*(#.*)?)?$ ]]; then
      value=${BASH_REMATCH[1]}
      [[ $value =~ ^[0-9A-Fa-f:.]+$ ]] || return "$DP_EXIT_DATAERR"
      found=1
    fi
  done < "$1"
  ((found == 1))
}

dp__diag_check_os() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local file=$1 output_name=$2
  local -A os=() result=()
  if ! dp_diag_read_os_release "$file" os; then
    result[STATUS]=critical
    result[SUMMARY]='operating-system data is missing or malformed'
  elif [[ ${os[ID]} == ubuntu && (${os[VERSION_ID]} == 24.04 || ${os[VERSION_ID]} == 26.04) ]]; then
    result[STATUS]=pass
    result[SUMMARY]="Ubuntu ${os[VERSION_ID]} is supported"
  else
    result[STATUS]=critical
    result[SUMMARY]='operating system is not a supported Ubuntu release'
  fi
  dp__diag_commit_array result "$output_name"
}

dp__diag_check_capacity() {
  [[ $# -eq 4 ]] || return "$DP_EXIT_USAGE"
  local cpu_file=$1 memory_file=$2 data_root=$3 output_name=$4
  local cpu_count= memory_kib= memory_mib= disk_total_kib= disk_available_kib= disk_total_mib= disk_available_mib= df_text
  local -a statuses=()
  local -A result=()
  if dp_diag_read_cpu_count "$cpu_file" cpu_count; then
    ((cpu_count < 2)) && statuses+=(warning) || statuses+=(pass)
  else
    statuses+=(critical)
  fi
  if dp_diag_read_memory_kib "$memory_file" memory_kib; then
    memory_mib=$((memory_kib / 1024))
    ((memory_mib < 4096)) && statuses+=(warning) || statuses+=(pass)
  else
    statuses+=(critical)
  fi
  if dp_command_exists df && df_text=$(df -Pk -- "$data_root" 2>/dev/null) && dp__diag_parse_df "$df_text" disk_total_kib disk_available_kib; then
    disk_total_mib=$((disk_total_kib / 1024))
    disk_available_mib=$((disk_available_kib / 1024))
    ((disk_available_mib < 20480)) && statuses+=(warning) || statuses+=(pass)
  else
    statuses+=(critical)
  fi
  result[STATUS]=$(dp__diag_worst_status "${statuses[@]}")
  if [[ -n $cpu_count && -n $memory_mib && -n $disk_available_mib ]]; then
    result[SUMMARY]="$cpu_count logical CPU(s); $memory_mib MiB memory; managed-root space $disk_total_mib MiB total, $disk_available_mib MiB available"
    result[CPU_COUNT]=$cpu_count
    result[MEMORY_MIB]=$memory_mib
    result[DISK_TOTAL_MIB]=$disk_total_mib
    result[DISK_AVAILABLE_MIB]=$disk_available_mib
  else
    result[SUMMARY]='one or more capacity metrics are unavailable or malformed'
  fi
  dp__diag_commit_array result "$output_name"
}

dp__diag_check_docker() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local output_name=$1 raw version
  local -A result=()
  if ! dp_command_exists docker; then
    result[STATUS]=critical
    result[SUMMARY]='Docker client is unavailable'
  elif raw=$(docker --version 2>&1) && dp__diag_parse_docker_version "$raw" version; then
    result[STATUS]=pass
    result[SUMMARY]="Docker client version $version is available"
  else
    result[STATUS]=critical
    result[SUMMARY]='Docker client version is unavailable or malformed'
  fi
  dp__diag_commit_array result "$output_name"
}

dp__diag_check_compose() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local output_name=$1 raw version
  local -A result=()
  if ! dp_command_exists docker; then
    result[STATUS]=critical
    result[SUMMARY]='Docker Compose v2 is unavailable'
  elif raw=$(docker compose version 2>&1) && dp__diag_parse_compose_version "$raw" version; then
    result[STATUS]=pass
    result[SUMMARY]="Docker Compose v2 version $version is available"
  else
    result[STATUS]=critical
    result[SUMMARY]='Docker Compose v2 is unavailable or malformed'
  fi
  dp__diag_commit_array result "$output_name"
}

dp__diag_check_nginx() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local output_name=$1 raw version
  local -A result=()
  if ! dp_command_exists nginx; then
    result[STATUS]=critical
    result[SUMMARY]='Nginx is unavailable'
  elif raw=$(nginx -v 2>&1) && dp__diag_parse_nginx_version "$raw" version; then
    result[STATUS]=pass
    result[SUMMARY]="Nginx version $version is available"
  else
    result[STATUS]=critical
    result[SUMMARY]='Nginx version is unavailable or malformed'
  fi
  dp__diag_commit_array result "$output_name"
}

dp__diag_check_systemd() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local output_name=$1 version_text state
  local -A result=()
  if ! dp_command_exists systemctl; then
    result[STATUS]=critical
    result[SUMMARY]='systemd tooling is unavailable'
  elif ! version_text=$(systemctl --version 2>/dev/null) || [[ ! $version_text =~ (^|$'\n')systemd[[:space:]]+[0-9]+([[:space:]]|$) ]]; then
    result[STATUS]=critical
    result[SUMMARY]='systemd version is unavailable or malformed'
  else
    state=$(systemctl is-system-running 2>/dev/null) || true
    case $state in
      running) result[STATUS]=pass; result[SUMMARY]='systemd is running' ;;
      degraded) result[STATUS]=warning; result[SUMMARY]='systemd reports a degraded state' ;;
      *) result[STATUS]=critical; result[SUMMARY]='systemd is not in a usable running state' ;;
    esac
  fi
  dp__diag_commit_array result "$output_name"
}

dp__diag_check_listeners() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local output_name=$1 raw
  local -A parsed=() result=()
  if ! dp_command_exists ss; then
    result[STATUS]=warning
    result[SUMMARY]='listener inspection capability is unavailable'
  elif raw=$(ss -H -lntu 2>/dev/null) && dp_diag_parse_listener_text "$raw" parsed; then
    result[STATUS]=pass
    result[SUMMARY]="${parsed[TCP_COUNT]} TCP, ${parsed[UDP_COUNT]} UDP, ${parsed[WILDCARD_COUNT]} wildcard listener(s)"
  else
    result[STATUS]=warning
    result[SUMMARY]='listener inspection output is unavailable or malformed'
  fi
  dp__diag_commit_array result "$output_name"
}

dp__diag_check_time_sync() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local output_name=$1 value
  local -A result=()
  if dp_command_exists timedatectl && value=$(timedatectl show -p NTPSynchronized --value 2>/dev/null) && dp__diag_parse_time_sync "$value"; then
    if [[ $value == yes ]]; then
      result[STATUS]=pass
      result[SUMMARY]='local time synchronization is active'
    else
      result[STATUS]=warning
      result[SUMMARY]='local time synchronization is not active'
    fi
  else
    result[STATUS]=warning
    result[SUMMARY]='local time-synchronization status is unavailable'
  fi
  dp__diag_commit_array result "$output_name"
}

dp__diag_check_dns() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local resolver_file=$1 output_name=$2
  local -A result=()
  if dp__diag_resolver_configured "$resolver_file" && dp_command_exists getent && getent hosts localhost >/dev/null 2>&1; then
    result[STATUS]=pass
    result[SUMMARY]='resolver configuration and local hostname resolution are available; external DNS is unverified'
  else
    result[STATUS]=warning
    result[SUMMARY]='resolver configuration or local hostname resolution is unavailable; external DNS is unverified'
  fi
  dp__diag_commit_array result "$output_name"
}

dp_diag_collect() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local output_name=$1 id overall
  local -A collected=() check_result=()
  local -a statuses=()
  dp__diag_is_associative_array "$output_name" || return "$DP_EXIT_USAGE"

  dp__diag_check_os /etc/os-release check_result || return "$DP_EXIT_SOFTWARE"
  dp__diag_set_result collected operating_system "${check_result[STATUS]}" "${check_result[SUMMARY]}" || return "$DP_EXIT_SOFTWARE"
  check_result=()
  dp_diag_inventory_commands check_result || return "$DP_EXIT_SOFTWARE"
  dp__diag_set_result collected required_commands "${check_result[STATUS]}" "${check_result[SUMMARY]}" || return "$DP_EXIT_SOFTWARE"
  check_result=()
  dp__diag_check_capacity /proc/cpuinfo /proc/meminfo /data check_result || return "$DP_EXIT_SOFTWARE"
  dp__diag_set_result collected capacity "${check_result[STATUS]}" "${check_result[SUMMARY]}" || return "$DP_EXIT_SOFTWARE"
  check_result=()
  dp_diag_check_filesystem /data check_result || return "$DP_EXIT_SOFTWARE"
  dp__diag_set_result collected filesystem "${check_result[STATUS]}" "${check_result[SUMMARY]}" || return "$DP_EXIT_SOFTWARE"
  check_result=()
  dp__diag_check_docker check_result || return "$DP_EXIT_SOFTWARE"
  dp__diag_set_result collected docker "${check_result[STATUS]}" "${check_result[SUMMARY]}" || return "$DP_EXIT_SOFTWARE"
  check_result=()
  dp__diag_check_compose check_result || return "$DP_EXIT_SOFTWARE"
  dp__diag_set_result collected docker_compose "${check_result[STATUS]}" "${check_result[SUMMARY]}" || return "$DP_EXIT_SOFTWARE"
  check_result=()
  dp__diag_check_nginx check_result || return "$DP_EXIT_SOFTWARE"
  dp__diag_set_result collected nginx "${check_result[STATUS]}" "${check_result[SUMMARY]}" || return "$DP_EXIT_SOFTWARE"
  check_result=()
  dp__diag_check_systemd check_result || return "$DP_EXIT_SOFTWARE"
  dp__diag_set_result collected systemd "${check_result[STATUS]}" "${check_result[SUMMARY]}" || return "$DP_EXIT_SOFTWARE"
  check_result=()
  dp__diag_check_listeners check_result || return "$DP_EXIT_SOFTWARE"
  dp__diag_set_result collected listeners "${check_result[STATUS]}" "${check_result[SUMMARY]}" || return "$DP_EXIT_SOFTWARE"
  check_result=()
  dp__diag_check_time_sync check_result || return "$DP_EXIT_SOFTWARE"
  dp__diag_set_result collected time_sync "${check_result[STATUS]}" "${check_result[SUMMARY]}" || return "$DP_EXIT_SOFTWARE"
  check_result=()
  dp__diag_check_dns /etc/resolv.conf check_result || return "$DP_EXIT_SOFTWARE"
  dp__diag_set_result collected dns "${check_result[STATUS]}" "${check_result[SUMMARY]}" || return "$DP_EXIT_SOFTWARE"

  for id in "${DP_DIAG_CHECK_IDS[@]}"; do statuses+=("${collected[$id.status]}"); done
  overall=$(dp__diag_worst_status "${statuses[@]}") || return "$DP_EXIT_SOFTWARE"
  collected[overall_status]=$overall
  dp__diag_commit_array collected "$output_name"
}

dp__diag_validate_results() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local results_name=$1 id recalculated
  local -a statuses=()
  dp__diag_is_associative_array "$results_name" || return "$DP_EXIT_USAGE"
  local -n dp__diag_results_ref=$results_name
  [[ -v dp__diag_results_ref[overall_status] ]] || return "$DP_EXIT_DATAERR"
  for id in "${DP_DIAG_CHECK_IDS[@]}"; do
    [[ -v dp__diag_results_ref[$id.status] && -v dp__diag_results_ref[$id.summary] ]] || return "$DP_EXIT_DATAERR"
    [[ ${dp__diag_results_ref[$id.status]} == pass || ${dp__diag_results_ref[$id.status]} == warning || ${dp__diag_results_ref[$id.status]} == critical ]] || return "$DP_EXIT_DATAERR"
    dp__diag_safe_text "${dp__diag_results_ref[$id.summary]}" || return "$DP_EXIT_DATAERR"
    statuses+=("${dp__diag_results_ref[$id.status]}")
  done
  recalculated=$(dp__diag_worst_status "${statuses[@]}") || return "$DP_EXIT_DATAERR"
  [[ ${dp__diag_results_ref[overall_status]} == "$recalculated" ]]
}

dp_diag_render_text() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local results_name=$1 id
  dp__diag_validate_results "$results_name" || return "$DP_EXIT_DATAERR"
  local -n dp__diag_text_ref=$results_name
  printf 'ZolexoraDeployment doctor (DP-05)\nDiagnostic contract version: %s\nOverall status: %s\nChecks:\n' \
    "$DP_DIAG_CONTRACT_VERSION" "${dp__diag_text_ref[overall_status]^^}"
  for id in "${DP_DIAG_CHECK_IDS[@]}"; do
    printf -- '- %s: %s - %s\n' "$id" "${dp__diag_text_ref[$id.status]^^}" "${dp__diag_text_ref[$id.summary]}"
  done
  printf 'This diagnostic result does not certify the repository or host as production-ready.\n'
}

dp__diag_json_escape() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local value=$1
  value=${value//\\/\\\\}
  value=${value//\"/\\\"}
  value=${value//$'\b'/\\b}
  value=${value//$'\f'/\\f}
  value=${value//$'\n'/\\n}
  value=${value//$'\r'/\\r}
  value=${value//$'\t'/\\t}
  [[ $value != *[[:cntrl:]]* ]] || return "$DP_EXIT_DATAERR"
  printf '%s' "$value"
}

dp_diag_render_json() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local results_name=$1 id comma= summary
  dp__diag_validate_results "$results_name" || return "$DP_EXIT_DATAERR"
  local -n dp__diag_json_ref=$results_name
  printf '{\n  "contract_version": "%s",\n  "overall_status": "%s",\n  "checks": [\n' \
    "$DP_DIAG_CONTRACT_VERSION" "${dp__diag_json_ref[overall_status]}"
  for id in "${DP_DIAG_CHECK_IDS[@]}"; do
    summary=$(dp__diag_json_escape "${dp__diag_json_ref[$id.summary]}") || return "$DP_EXIT_DATAERR"
    printf '%s    {"id": "%s", "status": "%s", "summary": "%s"}' \
      "$comma" "$id" "${dp__diag_json_ref[$id.status]}" "$summary"
    comma=$',\n'
  done
  printf '\n  ],\n  "production_ready": false\n}\n'
}

dp_diag_status_exit() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  case $1 in
    pass) return 0 ;;
    warning) return 1 ;;
    critical) return 2 ;;
    *) return "$DP_EXIT_SOFTWARE" ;;
  esac
}
