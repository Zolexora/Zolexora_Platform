#!/usr/bin/env bash

if [[ ${DP_RUNTIME_SH_LOADED:-0} == 1 ]]; then
  return 0 2>/dev/null || exit 0
fi
readonly DP_RUNTIME_SH_LOADED=1

readonly DP_EXIT_SUCCESS=0
readonly DP_EXIT_USAGE=64
readonly DP_EXIT_DATAERR=65
readonly DP_EXIT_NOINPUT=66
readonly DP_EXIT_UNAVAILABLE=69
readonly DP_EXIT_SOFTWARE=70
readonly DP_EXIT_CANTCREAT=73
readonly DP_EXIT_IOERR=74
readonly DP_EXIT_TEMPFAIL=75
readonly DP_EXIT_NOPERM=77
readonly DP_EXIT_CONFIG=78

DP_LOG_LEVEL=INFO

dp__log_level_rank() {
  case ${1-} in
    DEBUG) printf '10\n' ;;
    INFO) printf '20\n' ;;
    WARN) printf '30\n' ;;
    ERROR) printf '40\n' ;;
    *) return "$DP_EXIT_DATAERR" ;;
  esac
}

dp_log_set_level() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  dp__log_level_rank "$1" >/dev/null || return "$DP_EXIT_DATAERR"
  DP_LOG_LEVEL=$1
}

dp_log() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local level=$1 message=$2 current_rank requested_rank
  requested_rank=$(dp__log_level_rank "$level") || return "$DP_EXIT_DATAERR"
  current_rank=$(dp__log_level_rank "$DP_LOG_LEVEL") || return "$DP_EXIT_SOFTWARE"
  ((requested_rank >= current_rank)) || return 0
  printf '%s: %s\n' "$level" "$message" >&2
}

dp_redact() {
  [[ $# -eq 1 ]] || return "$DP_EXIT_USAGE"
  printf '[REDACTED]\n'
}

dp_log_field() {
  [[ $# -eq 4 ]] || return "$DP_EXIT_USAGE"
  local level=$1 key=$2 value=$3 classification=$4 rendered
  [[ $key =~ ^[A-Za-z][A-Za-z0-9_.-]{0,63}$ ]] || return "$DP_EXIT_DATAERR"
  case $classification in
    public)
      [[ $value != *$'\n'* && $value != *$'\r'* ]] || return "$DP_EXIT_DATAERR"
      rendered=$value
      ;;
    secret) rendered='[REDACTED]' ;;
    *) return "$DP_EXIT_DATAERR" ;;
  esac
  dp_log "$level" "$key=$rendered"
}

dp_die() {
  [[ $# -eq 2 ]] || return "$DP_EXIT_USAGE"
  local exit_code=$1 message=$2
  [[ $exit_code =~ ^[0-9]{1,3}$ ]] || return "$DP_EXIT_DATAERR"
  exit_code=$((10#$exit_code))
  ((exit_code >= 1 && exit_code <= 255)) || return "$DP_EXIT_DATAERR"
  dp_log ERROR "$message" || return "$DP_EXIT_SOFTWARE"
  exit "$exit_code"
}

dp_command_exists() {
  [[ $# -eq 1 && -n $1 ]] || return "$DP_EXIT_USAGE"
  [[ $1 =~ ^[A-Za-z0-9_./+-]+$ ]] || return "$DP_EXIT_DATAERR"
  command -v -- "$1" >/dev/null 2>&1
}
