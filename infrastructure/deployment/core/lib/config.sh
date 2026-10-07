#!/usr/bin/env bash

if [[ ${DP_CONFIG_SH_LOADED:-0} == 1 ]]; then
  return 0 2>/dev/null || exit 0
fi
readonly DP_CONFIG_SH_LOADED=1

dp__config_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=validation.sh
source "$dp__config_dir/validation.sh"
unset dp__config_dir

readonly DP_CONFIG_MAX_BYTES=1048576

dp__config_valid_variable_name() {
  [[ ${1-} =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]
}

dp__config_is_indexed_array() {
  dp__config_valid_variable_name "${1-}" && [[ $(declare -p "$1" 2>/dev/null) == 'declare -a '* ]]
}

dp__config_is_associative_array() {
  dp__config_valid_variable_name "${1-}" && [[ $(declare -p "$1" 2>/dev/null) == 'declare -A '* ]]
}

dp__config_error() {
  printf 'ERROR: invalid configuration%s\n' "${1:+ at line $1}" >&2
  return "$DP_EXIT_CONFIG"
}

dp_config_load() {
  [[ $# -eq 3 ]] || return "$DP_EXIT_USAGE"
  local file=$1 allowed_name=$2 output_name=$3 line key value is_allowed line_number=0 size
  local -A parsed=()
  dp__config_is_indexed_array "$allowed_name" || return "$DP_EXIT_USAGE"
  dp__config_is_associative_array "$output_name" || return "$DP_EXIT_USAGE"
  [[ $allowed_name != "$output_name" ]] || return "$DP_EXIT_USAGE"
  local -n dp__allowed_ref=$allowed_name
  local -n dp__output_ref=$output_name

  local allowed_key
  for allowed_key in "${dp__allowed_ref[@]}"; do
    dp_is_valid_config_key "$allowed_key" || return "$DP_EXIT_DATAERR"
  done

  [[ -f $file && -r $file && ! -L $file ]] || return "$DP_EXIT_NOINPUT"
  size=$(stat -c '%s' -- "$file" 2>/dev/null) || return "$DP_EXIT_IOERR"
  ((size <= DP_CONFIG_MAX_BYTES)) || return "$DP_EXIT_CONFIG"
  if LC_ALL=C od -An -v -t x1 -- "$file" 2>/dev/null | grep -qw 00; then
    return "$DP_EXIT_CONFIG"
  fi

  while IFS= read -r line || [[ -n $line ]]; do
    line_number=$((line_number + 1))
    [[ $line != *$'\r' ]] || line=${line%$'\r'}
    [[ -n $line ]] || continue
    [[ $line != \#* ]] || continue
    if [[ ! $line =~ ^([A-Z][A-Z0-9_]*)=(.*)$ ]]; then
      dp__config_error "$line_number"
      return
    fi
    key=${BASH_REMATCH[1]}
    value=${BASH_REMATCH[2]}
    dp_is_valid_config_key "$key" || { dp__config_error "$line_number"; return; }
    [[ $value != [[:space:]]* ]] || { dp__config_error "$line_number"; return; }
    is_allowed=0
    for allowed_key in "${dp__allowed_ref[@]}"; do
      if [[ $key == "$allowed_key" ]]; then
        is_allowed=1
        break
      fi
    done
    ((is_allowed == 1)) || { dp__config_error "$line_number"; return; }
    [[ ! -v parsed[$key] ]] || { dp__config_error "$line_number"; return; }
    if [[ $value == *'$('* || $value == *'`'* || $value == *'${'* || $value =~ \$[A-Za-z_] ]]; then
      dp__config_error "$line_number"
      return
    fi
    parsed[$key]=$value
  done < "$file"

  dp__output_ref=()
  for key in "${!parsed[@]}"; do
    dp__output_ref[$key]=${parsed[$key]}
  done
}

dp_config_require_keys() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local config_name=$1 required_name=$2 key
  dp__config_is_associative_array "$config_name" || return "$DP_EXIT_USAGE"
  dp__config_is_indexed_array "$required_name" || return "$DP_EXIT_USAGE"
  local -n dp__config_ref=$config_name
  local -n dp__required_ref=$required_name
  for key in "${dp__required_ref[@]}"; do
    dp_is_valid_config_key "$key" || return "$DP_EXIT_DATAERR"
    if [[ ! -v dp__config_ref[$key] ]]; then
      printf 'ERROR: required configuration key is missing: %s\n' "$key" >&2
      return "$DP_EXIT_CONFIG"
    fi
  done
}

dp_config_get() {
  [[ $# -eq 3 ]] || return "$DP_EXIT_USAGE"
  local config_name=$1 key=$2 output_name=$3
  dp__config_is_associative_array "$config_name" || return "$DP_EXIT_USAGE"
  dp__config_valid_variable_name "$output_name" || return "$DP_EXIT_USAGE"
  [[ $config_name != "$output_name" ]] || return "$DP_EXIT_USAGE"
  dp_is_valid_config_key "$key" || return "$DP_EXIT_DATAERR"
  local -n dp__config_get_ref=$config_name
  [[ -v dp__config_get_ref[$key] ]] || return "$DP_EXIT_NOINPUT"
  printf -v "$output_name" '%s' "${dp__config_get_ref[$key]}"
}
