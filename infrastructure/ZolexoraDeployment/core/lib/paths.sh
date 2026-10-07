#!/usr/bin/env bash

if [[ ${DP_PATHS_SH_LOADED:-0} == 1 ]]; then
  return 0 2>/dev/null || exit 0
fi
readonly DP_PATHS_SH_LOADED=1

dp__paths_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=runtime.sh
source "$dp__paths_dir/runtime.sh"
unset dp__paths_dir

dp_path_contains_traversal() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  [[ $1 =~ (^|/)\.\.(/|$) ]]
}

dp__path_has_control() {
  [[ ${1-} == *[[:cntrl:]]* ]]
}

dp__path_nearest_existing_ancestor() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local candidate=$1 output_name=$2
  [[ $output_name =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || return "$DP_EXIT_DATAERR"
  while [[ ! -e $candidate && ! -L $candidate ]]; do
    [[ $candidate != / ]] || break
    candidate=${candidate%/*}
    [[ -n $candidate ]] || candidate=/
  done
  [[ ! -L $candidate || -e $candidate ]] || return "$DP_EXIT_DATAERR"
  printf -v "$output_name" '%s' "$candidate"
}

dp_path_canonicalize() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local path=$1 ancestor
  [[ -n $path && $path == /* && $path != / ]] || return "$DP_EXIT_DATAERR"
  dp__path_has_control "$path" && return "$DP_EXIT_DATAERR"
  dp_path_contains_traversal "$path" && return "$DP_EXIT_DATAERR"
  dp_command_exists realpath || return "$DP_EXIT_UNAVAILABLE"
  dp__path_nearest_existing_ancestor "$path" ancestor || return "$DP_EXIT_DATAERR"
  realpath -e -- "$ancestor" >/dev/null 2>&1 || return "$DP_EXIT_DATAERR"
  realpath -m -- "$path" 2>/dev/null
}

dp_path_is_within() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local target root
  target=$(dp_path_canonicalize "$1") || return "$DP_EXIT_DATAERR"
  root=$(dp_path_canonicalize "$2") || return "$DP_EXIT_DATAERR"
  [[ $target == "$root" || $target == "$root/"* ]]
}

dp__assert_allowed_root() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  [[ -n $1 && $1 == /* && $1 != / && ! -L $1 && -d $1 ]] || return "$DP_EXIT_DATAERR"
  dp_path_contains_traversal "$1" && return "$DP_EXIT_DATAERR"
  return 0
}

dp_assert_safe_managed_path() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local target=$1 allowed_root=$2 canonical_target canonical_root
  dp__assert_allowed_root "$allowed_root" || return "$DP_EXIT_DATAERR"
  canonical_root=$(realpath -e -- "$allowed_root" 2>/dev/null) || return "$DP_EXIT_DATAERR"
  canonical_target=$(dp_path_canonicalize "$target") || return "$DP_EXIT_DATAERR"
  [[ $canonical_target == "$canonical_root" || $canonical_target == "$canonical_root/"* ]] || return "$DP_EXIT_DATAERR"
  [[ $canonical_target != / ]] || return "$DP_EXIT_DATAERR"
}

dp_assert_safe_destructive_target() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local target=$1 allowed_root=$2 canonical_target canonical_root canonical_home
  dp__assert_allowed_root "$allowed_root" || return "$DP_EXIT_DATAERR"
  [[ -e $target && ! -L $target ]] || return "$DP_EXIT_NOINPUT"
  dp_path_contains_traversal "$target" && return "$DP_EXIT_DATAERR"
  canonical_root=$(realpath -e -- "$allowed_root" 2>/dev/null) || return "$DP_EXIT_DATAERR"
  canonical_target=$(realpath -e -- "$target" 2>/dev/null) || return "$DP_EXIT_DATAERR"
  canonical_home=$(realpath -m -- "${HOME:-/nonexistent-home}" 2>/dev/null) || canonical_home=/nonexistent-home
  [[ $canonical_target != / && $canonical_target != /data && $canonical_target != "$canonical_home" ]] || return "$DP_EXIT_DATAERR"
  [[ $canonical_target != "$canonical_root" && $canonical_target == "$canonical_root/"* ]] || return "$DP_EXIT_DATAERR"
}
