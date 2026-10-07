#!/usr/bin/env bash

if [[ ${DP_VALIDATION_SH_LOADED:-0} == 1 ]]; then
  return 0 2>/dev/null || exit 0
fi
readonly DP_VALIDATION_SH_LOADED=1

dp__validation_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=runtime.sh
source "$dp__validation_dir/runtime.sh"
unset dp__validation_dir

dp_is_nonempty() {
  [[ $# -eq 1 && -n $1 ]]
}

dp_is_valid_identifier() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local value=$1
  ((${#value} >= 1 && ${#value} <= 63)) || return 1
  [[ $value =~ ^[a-z]([a-z0-9-]*[a-z0-9])?$ ]] || return 1
  [[ $value != *--* ]]
}

dp__safe_label() {
  [[ ${1-} =~ ^[A-Za-z][A-Za-z0-9_-]{0,63}$ ]]
}

dp_require_identifier() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local value=$1 label=$2
  dp__safe_label "$label" || label=value
  if ! dp_is_valid_identifier "$value"; then
    printf 'ERROR: invalid %s identifier\n' "$label" >&2
    return "$DP_EXIT_DATAERR"
  fi
}

# Configuration keys are limited to 128 ASCII characters.
dp_is_valid_config_key() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  ((${#1} >= 1 && ${#1} <= 128)) || return 1
  [[ $1 =~ ^[A-Z][A-Z0-9_]*$ ]]
}

dp__uint_normalize() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local value=$1 output_name=$2
  [[ $output_name =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || return "$DP_EXIT_DATAERR"
  while [[ ${#value} -gt 1 && $value == 0* ]]; do
    value=${value#0}
  done
  printf -v "$output_name" '%s' "$value"
}

dp_is_valid_uint() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local value=$1 normalized LC_ALL=C
  [[ $value =~ ^[0-9]+$ ]] || return 1
  dp__uint_normalize "$value" normalized || return 1
  ((${#normalized} < 19)) && return 0
  ((${#normalized} == 19)) || return 1
  [[ $normalized == 9223372036854775807 || $normalized < 9223372036854775807 ]]
}

dp_require_uint_range() {
  [[ $# -eq 4 ]] || return "$DP_EXIT_USAGE"
  local value=$1 minimum=$2 maximum=$3 label=$4 normalized min_normalized max_normalized
  dp__safe_label "$label" || label=value
  if ! dp_is_valid_uint "$value" || ! dp_is_valid_uint "$minimum" || ! dp_is_valid_uint "$maximum"; then
    printf 'ERROR: invalid %s integer range\n' "$label" >&2
    return "$DP_EXIT_DATAERR"
  fi
  dp__uint_normalize "$value" normalized
  dp__uint_normalize "$minimum" min_normalized
  dp__uint_normalize "$maximum" max_normalized
  if ((10#$min_normalized > 10#$max_normalized || 10#$normalized < 10#$min_normalized || 10#$normalized > 10#$max_normalized)); then
    printf 'ERROR: %s is outside the allowed range\n' "$label" >&2
    return "$DP_EXIT_DATAERR"
  fi
}

dp_is_valid_release_id() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  [[ $1 =~ ^[0-9a-f]{40}$ ]]
}

dp__is_valid_image_repository() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local repository=$1 first port
  ((${#repository} >= 1 && ${#repository} <= 255)) || return 1
  [[ $repository =~ ^[a-z0-9]+([._-][a-z0-9]+)*(:[0-9]{1,5})?(/[a-z0-9]+([._-][a-z0-9]+)*)*$ ]] || return 1
  first=${repository%%/*}
  if [[ $first == *:* ]]; then
    port=${first##*:}
    dp_require_uint_range "$port" 1 65535 port >/dev/null 2>&1 || return 1
  fi
}

dp_is_valid_image_reference() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local reference=$1 repository suffix
  [[ -n $reference && $reference != *[[:space:]]* ]] || return 1
  [[ ${reference,,} != *:latest && ${reference,,} != *:latest@* ]] || return 1
  if [[ $reference == *@sha256:* ]]; then
    repository=${reference%@sha256:*}
    suffix=${reference##*@sha256:}
    [[ $suffix =~ ^[0-9a-f]{64}$ ]] || return 1
  elif [[ $reference == *:* ]]; then
    repository=${reference%:*}
    suffix=${reference##*:}
    dp_is_valid_release_id "$suffix" || return 1
  else
    return 1
  fi
  dp__is_valid_image_repository "$repository"
}

dp_is_valid_rfc3339_utc() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local value=$1 normalized
  [[ $value =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]] || return 1
  dp_command_exists date || return "$DP_EXIT_UNAVAILABLE"
  normalized=$(date -u -d "$value" '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null) || return 1
  [[ $normalized == "$value" ]]
}
