#!/usr/bin/env bash

if [[ ${DP_LOCKING_SH_LOADED:-0} == 1 ]]; then
  return 0 2>/dev/null || exit 0
fi
readonly DP_LOCKING_SH_LOADED=1

dp__locking_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=validation.sh
source "$dp__locking_dir/validation.sh"
unset dp__locking_dir

declare -gA DP__LOCKING_HELD_FDS=()

dp__locking_valid_variable_name() {
  [[ ${1-} =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]
}

dp_lock_acquire() {
  [[ $# -eq 3 ]] || return "$DP_EXIT_USAGE"
  local lock_path=$1 timeout=$2 output_name=$3 parent dp__locking_fd
  dp_command_exists flock || return "$DP_EXIT_UNAVAILABLE"
  dp__locking_valid_variable_name "$output_name" || return "$DP_EXIT_DATAERR"
  [[ -n $lock_path && $lock_path == /* && $lock_path != *[[:cntrl:]]* ]] || return "$DP_EXIT_DATAERR"
  [[ ! $lock_path =~ (^|/)\.\.(/|$) ]] || return "$DP_EXIT_DATAERR"
  dp_require_uint_range "$timeout" 0 300 timeout >/dev/null 2>&1 || return "$DP_EXIT_DATAERR"
  parent=${lock_path%/*}
  [[ -n $parent ]] || parent=/
  [[ -d $parent && ! -L $parent ]] || return "$DP_EXIT_NOINPUT"
  [[ ! -L $lock_path ]] || return "$DP_EXIT_DATAERR"
  [[ ! -e $lock_path || -f $lock_path ]] || return "$DP_EXIT_DATAERR"

  if ! exec {dp__locking_fd}>>"$lock_path"; then
    return "$DP_EXIT_CANTCREAT"
  fi
  if [[ -L $lock_path ]] || ! flock -w "$timeout" "$dp__locking_fd"; then
    exec {dp__locking_fd}>&-
    return "$DP_EXIT_TEMPFAIL"
  fi
  DP__LOCKING_HELD_FDS[$dp__locking_fd]=1
  if ! printf -v "$output_name" '%s' "$dp__locking_fd"; then
    flock -u "$dp__locking_fd" >/dev/null 2>&1 || true
    exec {dp__locking_fd}>&-
    unset 'DP__LOCKING_HELD_FDS[$dp__locking_fd]'
    return "$DP_EXIT_DATAERR"
  fi
}

dp_lock_release() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  local dp__locking_fd_name=$1 dp__locking_fd
  dp__locking_valid_variable_name "$dp__locking_fd_name" || return "$DP_EXIT_DATAERR"
  [[ -v $dp__locking_fd_name ]] || return "$DP_EXIT_DATAERR"
  dp__locking_fd=${!dp__locking_fd_name}
  [[ $dp__locking_fd =~ ^[0-9]+$ && -v DP__LOCKING_HELD_FDS[$dp__locking_fd] ]] || return "$DP_EXIT_DATAERR"
  flock -u "$dp__locking_fd" || return "$DP_EXIT_IOERR"
  exec {dp__locking_fd}>&-
  unset 'DP__LOCKING_HELD_FDS[$dp__locking_fd]'
  unset -v "$dp__locking_fd_name"
}
