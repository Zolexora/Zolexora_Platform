#!/usr/bin/env bash

if [[ ${DP_RELEASE_SH_LOADED:-0} == 1 ]]; then
  return 0 2>/dev/null || exit 0
fi
readonly DP_RELEASE_SH_LOADED=1

dp__release_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=config.sh
source "$dp__release_dir/config.sh"
unset dp__release_dir

dp__release_error() {
  printf 'ERROR: invalid release metadata: %s\n' "$1" >&2
  return "$DP_EXIT_DATAERR"
}

dp_release_validate() {
  [[ $# -eq 4 ]] || return "$DP_EXIT_USAGE"
  local application_id=$1 release_id=$2 created_at=$3 image_references=$4 image
  local -A seen=()
  dp_is_valid_identifier "$application_id" || { dp__release_error 'application identifier'; return; }
  dp_is_valid_release_id "$release_id" || { dp__release_error 'release identifier'; return; }
  dp_is_valid_rfc3339_utc "$created_at" || { dp__release_error 'creation timestamp'; return; }
  [[ -n $image_references && $image_references != ,* && $image_references != *, && $image_references != *,,* ]] || { dp__release_error 'image list'; return; }
  local -a images=()
  IFS=',' read -r -a images <<< "$image_references"
  ((${#images[@]} > 0)) || { dp__release_error 'image list'; return; }
  for image in "${images[@]}"; do
    [[ $image != *[[:space:]]* ]] || { dp__release_error 'image list whitespace'; return; }
    dp_is_valid_image_reference "$image" || { dp__release_error 'immutable image reference'; return; }
    [[ ! -v seen[$image] ]] || { dp__release_error 'duplicate image reference'; return; }
    seen[$image]=1
  done
}

dp_release_metadata_render() {
  [[ $# -eq 4 ]] || return "$DP_EXIT_USAGE"
  dp_release_validate "$@" || return
  printf 'APPLICATION_ID=%s\nRELEASE_ID=%s\nCREATED_AT_UTC=%s\nIMAGE_REFERENCES=%s\n' "$1" "$2" "$3" "$4"
}

dp_release_metadata_load() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local file=$1 output_name=$2 key
  [[ $output_name =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || return "$DP_EXIT_USAGE"
  [[ $(declare -p "$output_name" 2>/dev/null) == 'declare -A '* ]] || return "$DP_EXIT_USAGE"
  local -a dp__release_allowed=(APPLICATION_ID RELEASE_ID CREATED_AT_UTC IMAGE_REFERENCES)
  local -a dp__release_required=(APPLICATION_ID RELEASE_ID CREATED_AT_UTC IMAGE_REFERENCES)
  local -A dp__release_values=()
  dp_config_load "$file" dp__release_allowed dp__release_values || return
  dp_config_require_keys dp__release_values dp__release_required || return
  dp_release_validate "${dp__release_values[APPLICATION_ID]}" "${dp__release_values[RELEASE_ID]}" "${dp__release_values[CREATED_AT_UTC]}" "${dp__release_values[IMAGE_REFERENCES]}" || return
  local -n dp__release_output_ref=$output_name
  dp__release_output_ref=()
  for key in "${dp__release_required[@]}"; do
    dp__release_output_ref[$key]=${dp__release_values[$key]}
  done
}
