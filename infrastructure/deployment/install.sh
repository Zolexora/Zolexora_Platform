#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  printf 'Usage: install.sh --dry-run [--format text|json]\n       install.sh --help\n'
}

if [[ $# -eq 0 ]]; then
  printf '%s\n' 'ERROR: install.sh is not implemented for host installation as of DP-07; no operation was performed.' >&2
  exit 78
fi

if [[ $# -eq 1 && $1 == --help ]]; then
  usage
  exit 0
fi

format=text
if [[ $# -eq 1 && $1 == --dry-run ]]; then
  :
elif [[ $# -eq 3 && $1 == --dry-run && $2 == --format && ($3 == text || $3 == json) ]]; then
  format=$3
else
  printf '%s\n' 'ERROR: invalid install.sh usage; only dry-run planning is available.' >&2
  exit 64
fi

dp__install_command_error() {
  printf '%s\n' 'ERROR: installation planning failed internally; no operation was performed.' >&2
  exit 70
}
trap dp__install_command_error ERR

repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
[[ ${repo_root##*/} == ZolexoraDeployment || ${repo_root##*/} == deployment ]] || dp__install_command_error

# shellcheck source=core/lib/runtime.sh
source "$repo_root/core/lib/runtime.sh"
# shellcheck source=core/lib/validation.sh
source "$repo_root/core/lib/validation.sh"
# shellcheck source=core/lib/paths.sh
source "$repo_root/core/lib/paths.sh"
# shellcheck source=core/lib/diagnostics.sh
source "$repo_root/core/lib/diagnostics.sh"
# shellcheck source=core/lib/installation.sh
source "$repo_root/core/lib/installation.sh"

declare -A diagnostics=() layout=() layout_contract=() layout_existing=() layout_evaluation=()
declare -A os=() packages=() package_evaluation=() plan=()

dp_diag_collect diagnostics || dp__install_command_error
dp_install_read_filesystem_manifest "$repo_root/core/install/filesystem-layout.tsv" layout || dp__install_command_error
dp_install_validate_layout layout layout_contract || dp__install_command_error
dp_install_inspect_layout layout layout_existing || dp__install_command_error
layout_evaluation[CONTRACT_STATUS]=${layout_contract[STATUS]}
layout_evaluation[CONTRACT_SUMMARY]=${layout_contract[SUMMARY]}
layout_evaluation[EXISTING_STATUS]=${layout_existing[STATUS]}
layout_evaluation[EXISTING_SUMMARY]=${layout_existing[SUMMARY]}

if dp_diag_read_os_release /etc/os-release os && dp_install_read_package_manifest "$repo_root/core/install/ubuntu-packages.tsv" "${os[ID]}" "${os[VERSION_ID]}" packages; then
  dp_install_inventory_packages packages package_evaluation || dp__install_command_error
else
  package_evaluation[REQUIRED_STATUS]=critical
  package_evaluation[REQUIRED_SUMMARY]='package planning requires a supported Ubuntu release'
  package_evaluation[VERSION_STATUS]=critical
  package_evaluation[VERSION_SUMMARY]='exact package versions remain unresolved'
  package_evaluation[SOURCE_STATUS]=critical
  package_evaluation[SOURCE_SUMMARY]='package source identity remains unresolved'
fi

dp_install_build_plan diagnostics layout_evaluation package_evaluation plan || dp__install_command_error
if [[ $format == json ]]; then
  dp_install_render_json plan || dp__install_command_error
else
  dp_install_render_text plan || dp__install_command_error
fi

case ${plan[overall_status]} in
  pass) exit 0 ;;
  warning) exit 1 ;;
  critical) exit 2 ;;
  *) exit 70 ;;
esac
