#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  printf 'Usage: doctor.sh [--format text|json]\n       doctor.sh --help\n'
}

format=text
case $# in
  0) ;;
  1)
    if [[ $1 == --help ]]; then
      usage
      exit 0
    fi
    printf 'ERROR: invalid doctor.sh usage\n' >&2
    exit 64
    ;;
  2)
    if [[ $1 != --format || ($2 != text && $2 != json) ]]; then
      printf 'ERROR: invalid doctor.sh usage\n' >&2
      exit 64
    fi
    format=$2
    ;;
  *)
    printf 'ERROR: invalid doctor.sh usage\n' >&2
    exit 64
    ;;
esac

dp__doctor_internal_error() {
  printf 'ERROR: host diagnostics failed internally\n' >&2
  exit 70
}
trap dp__doctor_internal_error ERR

repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
if [[ ${repo_root##*/} != ZolexoraDeployment ]]; then
  printf 'ERROR: unable to resolve the diagnostics library root\n' >&2
  exit 70
fi

# shellcheck source=core/lib/runtime.sh
source "$repo_root/core/lib/runtime.sh"
# shellcheck source=core/lib/validation.sh
source "$repo_root/core/lib/validation.sh"
# shellcheck source=core/lib/paths.sh
source "$repo_root/core/lib/paths.sh"
# shellcheck source=core/lib/diagnostics.sh
source "$repo_root/core/lib/diagnostics.sh"

declare -A results=()
dp_diag_collect results || dp__doctor_internal_error

if [[ $format == json ]]; then
  dp_diag_render_json results || { printf 'ERROR: unable to render diagnostics\n' >&2; exit 70; }
else
  dp_diag_render_text results || { printf 'ERROR: unable to render diagnostics\n' >&2; exit 70; }
fi

case ${results[overall_status]} in
  pass) exit 0 ;;
  warning) exit 1 ;;
  critical) exit 2 ;;
  *) exit 70 ;;
esac
