#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(git -C "$script_dir" rev-parse --show-toplevel)
# shellcheck source=../lib/test-helpers.sh
source "$repo_root/tests/lib/test-helpers.sh"
# shellcheck source=../../core/lib/runtime.sh
source "$repo_root/core/lib/runtime.sh"
# shellcheck source=../../core/lib/validation.sh
source "$repo_root/core/lib/validation.sh"
# shellcheck source=../../core/lib/paths.sh
source "$repo_root/core/lib/paths.sh"
# shellcheck source=../../core/lib/diagnostics.sh
source "$repo_root/core/lib/diagnostics.sh"
# shellcheck source=../../core/lib/installation.sh
source "$repo_root/core/lib/installation.sh"

fixture_dir=$repo_root/tests/fixtures/install
temp_dir=
dp_test_make_temp_dir temp_dir
trap 'dp_test_cleanup_temp_dir "$temp_dir"' EXIT

source_dir=$temp_dir/source-check
mkdir -- "$source_dir"
source_bin=$source_dir/bin
mkdir -- "$source_bin"
source_marker=$source_dir/host-inspection-marker
for source_command in stat dpkg-query apt-cache getent; do
  printf '#!/bin/bash\nprintf invoked > "%s"\nexit 99\n' "$source_marker" > "$source_bin/$source_command"
  chmod 0755 "$source_bin/$source_command"
done
before=$(find "$source_dir" -mindepth 1 ! -path "$source_marker" -print | sort)
source_output=$(cd -- "$source_dir" && PATH=$source_bin:$PATH /bin/bash -c 'unset DP_INSTALLATION_SH_LOADED; source "$1"; source "$1"' -- "$repo_root/core/lib/installation.sh" 2>&1)
after=$(find "$source_dir" -mindepth 1 ! -path "$source_marker" -print | sort)
dp_test_assert_eq '' "$source_output" 'installation source-time silence'
dp_test_assert_eq "$before" "$after" 'installation source-time filesystem effects'
[[ ! -e $source_marker ]] || dp_test_fail 'installation source performed host inspection'

declare -A layout=() validation=()
dp_install_read_filesystem_manifest "$fixture_dir/filesystem-layout-valid.tsv" layout
dp_test_assert_eq 7 "${layout[COUNT]}" 'valid filesystem manifest count'
dp_install_validate_layout layout validation
dp_test_assert_eq pass "${validation[STATUS]}" 'valid filesystem manifest validation'
dp_test_assert_status "$DP_EXIT_DATAERR" 'duplicate filesystem path rejected' dp_install_read_filesystem_manifest "$fixture_dir/filesystem-layout-invalid.tsv" layout

layout=([SENTINEL]=kept)
dp_install_read_filesystem_manifest "$fixture_dir/filesystem-layout-invalid.tsv" layout >/dev/null 2>&1 || true
dp_test_assert_eq kept "${layout[SENTINEL]}" 'failed filesystem load changed caller output'
dp_install_read_filesystem_manifest "$fixture_dir/filesystem-layout-valid.tsv" layout

layout[PATH.6]=/data/projects
dp_install_validate_layout layout validation
dp_test_assert_eq critical "${validation[STATUS]}" 'duplicate path contract classification'
dp_install_read_filesystem_manifest "$fixture_dir/filesystem-layout-valid.tsv" layout
layout[PATH.0]=/database
dp_install_validate_layout layout validation
dp_test_assert_eq critical "${validation[STATUS]}" 'prefix confusion classification'
dp_install_read_filesystem_manifest "$fixture_dir/filesystem-layout-valid.tsv" layout
layout[PATH.1]=/data/../projects
dp_install_validate_layout layout validation
dp_test_assert_eq critical "${validation[STATUS]}" 'traversal classification'
dp_install_read_filesystem_manifest "$fixture_dir/filesystem-layout-valid.tsv" layout
layout[PATH.1]='/data/projects;unsafe'
dp_install_validate_layout layout validation
dp_test_assert_eq critical "${validation[STATUS]}" 'unsafe path metacharacter classification'
dp_install_read_filesystem_manifest "$fixture_dir/filesystem-layout-valid.tsv" layout
layout[MODE.1]=075
dp_install_validate_layout layout validation
dp_test_assert_eq critical "${validation[STATUS]}" 'invalid mode classification'
dp_install_read_filesystem_manifest "$fixture_dir/filesystem-layout-valid.tsv" layout
layout[MODE.1]=0777
dp_install_validate_layout layout validation
dp_test_assert_eq critical "${validation[STATUS]}" 'world-writable mode classification'
dp_install_read_filesystem_manifest "$fixture_dir/filesystem-layout-valid.tsv" layout
layout[PATH.0]=/data/missing-root
dp_install_validate_layout layout validation
dp_test_assert_eq critical "${validation[STATUS]}" 'missing canonical root classification'
dp_install_read_filesystem_manifest "$fixture_dir/filesystem-layout-valid.tsv" layout
layout[COUNT]=6
dp_install_validate_layout layout validation
dp_test_assert_eq critical "${validation[STATUS]}" 'missing direct child classification'
dp_install_read_filesystem_manifest "$fixture_dir/filesystem-layout-valid.tsv" layout
layout[COUNT]=8
layout[PATH.7]=/data/extra
dp_install_validate_layout layout validation
dp_test_assert_eq critical "${validation[STATUS]}" 'extra direct child classification'

dp_install_read_filesystem_manifest "$fixture_dir/filesystem-layout-valid.tsv" layout
managed_root=$temp_dir/managed
mkdir -p -- "$managed_root"/{projects,backups,logs,secrets,ssl,scripts}
chmod 0755 "$managed_root" "$managed_root/scripts"
chmod 0750 "$managed_root/projects" "$managed_root/backups" "$managed_root/logs"
chmod 0700 "$managed_root/secrets" "$managed_root/ssl"
fake_bin=$temp_dir/bin
mkdir -- "$fake_bin"
printf '#!/bin/bash\nif [[ $2 == %%u || $2 == %%g ]]; then printf "0\\n"; else exec /usr/bin/stat "$@"; fi\n' > "$fake_bin/stat"
chmod 0755 "$fake_bin/stat"
declare -A existing=()
PATH=$fake_bin:$PATH dp__install_inspect_layout_at layout "$managed_root" existing
dp_test_assert_eq warning "${existing[STATUS]}" 'safe layout with unresolved service identity'
dp_test_assert_eq unverified "${existing[STATE]}" 'ownership-policy normalization'
dp_test_assert_not_contains "${existing[SUMMARY]}" '0' 'raw ownership identifier leaked'

declare -A missing_layout=()
PATH=$fake_bin:$PATH dp__install_inspect_layout_at layout "$temp_dir/not-present" missing_layout
dp_test_assert_eq critical "${missing_layout[STATUS]}" 'missing layout root'
partial_root=$temp_dir/partial
mkdir -p -- "$partial_root/projects"
chmod 0755 "$partial_root"
chmod 0750 "$partial_root/projects"
PATH=$fake_bin:$PATH dp__install_inspect_layout_at layout "$partial_root" existing
dp_test_assert_eq critical "${existing[STATUS]}" 'partial installation detection'
conflict_root=$temp_dir/conflict
mkdir -p -- "$conflict_root"/{backups,logs,secrets,ssl,scripts}
printf 'conflicting file\n' > "$conflict_root/projects"
chmod 0755 "$conflict_root" "$conflict_root/scripts"
chmod 0750 "$conflict_root/backups" "$conflict_root/logs"
chmod 0700 "$conflict_root/secrets" "$conflict_root/ssl"
PATH=$fake_bin:$PATH dp__install_inspect_layout_at layout "$conflict_root" existing
dp_test_assert_eq critical "${existing[STATUS]}" 'file-directory conflict detection'
symlink_root=$temp_dir/symlink-layout
mkdir -p -- "$symlink_root"/{backups,logs,secrets,ssl,scripts}
ln -s -- "$temp_dir" "$symlink_root/projects"
PATH=$fake_bin:$PATH dp__install_inspect_layout_at layout "$symlink_root" existing
dp_test_assert_eq critical "${existing[STATUS]}" 'managed symlink rejection'

declare -A packages=()
dp_install_read_package_manifest "$fixture_dir/ubuntu-packages-valid.tsv" ubuntu 24.04 packages
dp_test_assert_eq 18 "${packages[COUNT]}" 'valid package manifest count on Ubuntu 24.04'
dp_install_read_package_manifest "$fixture_dir/ubuntu-packages-valid.tsv" ubuntu 26.04 packages
dp_test_assert_eq 18 "${packages[COUNT]}" 'valid package manifest count on Ubuntu 26.04'
dp_test_assert_eq optional "${packages[REQUIREMENT.16]}" 'Docker Buildx remains optional on production hosts'
dp_test_assert_status "$DP_EXIT_DATAERR" 'duplicate package record rejected' dp_install_read_package_manifest "$fixture_dir/ubuntu-packages-invalid.tsv" ubuntu 24.04 packages
dp_test_assert_status "$DP_EXIT_DATAERR" 'unsupported Ubuntu version rejected' dp_install_read_package_manifest "$fixture_dir/ubuntu-packages-valid.tsv" ubuntu 22.04 packages

invalid_package=$temp_dir/invalid-package.tsv
sed 's/\tbash\t/\tInvalid_Package\t/' "$fixture_dir/ubuntu-packages-valid.tsv" > "$invalid_package"
dp_test_assert_status "$DP_EXIT_DATAERR" 'invalid package name rejected' dp_install_read_package_manifest "$invalid_package" ubuntu 24.04 packages
missing_compose=$temp_dir/missing-compose.tsv
sed '/^docker-compose-v2/d' "$fixture_dir/ubuntu-packages-valid.tsv" > "$missing_compose"
dp_test_assert_status "$DP_EXIT_DATAERR" 'Docker Compose v2 contract required' dp_install_read_package_manifest "$missing_compose" ubuntu 24.04 packages

declare -A installed=()
dp_install_parse_dpkg_status "$(<"$fixture_dir/dpkg-installed.txt")" installed
dp_test_assert_eq 3 "${installed[COUNT]}" 'installed package parsing'
dp_install_parse_dpkg_status "$(<"$fixture_dir/dpkg-partial.txt")" installed
dp_test_assert_eq partial "${installed[STATE.1]}" 'partial package parsing'
dp_test_assert_status "$DP_EXIT_DATAERR" 'malformed dpkg output rejected' dp_install_parse_dpkg_status 'malformed' installed
duplicate_dpkg=$'bash\t1.0-fixture\tinstall ok installed\nbash\t1.0-fixture\tinstall ok installed'
dp_test_assert_status "$DP_EXIT_DATAERR" 'duplicate dpkg output rejected' dp_install_parse_dpkg_status "$duplicate_dpkg" installed

dp_install_read_package_manifest "$fixture_dir/ubuntu-packages-valid.tsv" ubuntu 24.04 packages
printf '#!/bin/bash\nseen=0\nfor value in "$@"; do if ((seen)); then printf "%%s\\t1.0-fixture\\tinstall ok installed\\n" "$value"; elif [[ $value == -- ]]; then seen=1; fi; done\n' > "$fake_bin/dpkg-query"
chmod 0755 "$fake_bin/dpkg-query"
declare -A package_inventory=()
PATH=$fake_bin:$PATH dp_install_inventory_packages packages package_inventory
dp_test_assert_eq pass "${package_inventory[REQUIRED_STATUS]}" 'complete local package inventory'
dp_test_assert_eq critical "${package_inventory[VERSION_STATUS]}" 'unresolved exact version policy'
dp_test_assert_eq critical "${package_inventory[SOURCE_STATUS]}" 'unresolved Docker source policy'
dp_test_assert_eq pass "${package_inventory[COMPOSE_STATUS]}" 'Docker Compose v2 policy'
printf '#!/bin/bash\nseen=0\nfor value in "$@"; do if ((seen)) && [[ $value != docker-buildx-plugin ]]; then printf "%%s\\t1.0-fixture\\tinstall ok installed\\n" "$value"; elif [[ $value == -- ]]; then seen=1; fi; done\n' > "$fake_bin/dpkg-query"
chmod 0755 "$fake_bin/dpkg-query"
PATH=$fake_bin:$PATH dp_install_inventory_packages packages package_inventory
dp_test_assert_eq pass "${package_inventory[REQUIRED_STATUS]}" 'missing optional Buildx does not fail required inventory'
dp_test_assert_eq 1 "${package_inventory[OPTIONAL_MISSING_COUNT]}" 'missing optional package count'
printf '#!/bin/bash\nprintf "bash\\t1.0-fixture\\tinstall ok installed\\ndocker-compose-plugin\\t2.0-fixture\\tinstall ok unpacked\\n"\n' > "$fake_bin/dpkg-query"
chmod 0755 "$fake_bin/dpkg-query"
PATH=$fake_bin:$PATH dp_install_inventory_packages packages package_inventory
dp_test_assert_eq critical "${package_inventory[REQUIRED_STATUS]}" 'missing and partial package inventory'

declare -A diagnostics=() layout_evaluation=() plan=()
for check_id in "${DP_DIAG_CHECK_IDS[@]}"; do
  diagnostics["$check_id.status"]=pass
  diagnostics["$check_id.summary"]='safe fixture diagnostic'
done
diagnostics[overall_status]=pass
layout_evaluation[CONTRACT_STATUS]=pass
layout_evaluation[CONTRACT_SUMMARY]='filesystem contract is valid'
layout_evaluation[EXISTING_STATUS]=warning
layout_evaluation[EXISTING_SUMMARY]='filesystem state is not present'
package_inventory[REQUIRED_STATUS]=pass
package_inventory[REQUIRED_SUMMARY]='required packages are present'
package_inventory[VERSION_STATUS]=critical
package_inventory[VERSION_SUMMARY]='exact versions are unresolved'
package_inventory[SOURCE_STATUS]=critical
package_inventory[SOURCE_SUMMARY]='package source is unresolved'
dp_install_build_plan diagnostics layout_evaluation package_inventory plan
dp_test_assert_eq critical "${plan[overall_status]}" 'plan severity aggregation'
declare -A second_plan=()
dp_install_build_plan diagnostics layout_evaluation package_inventory second_plan
dp_test_assert_eq "$(dp_install_render_json plan)" "$(dp_install_render_json second_plan)" 'idempotent plan generation'
dp_test_assert_status 0 'install pass exit mapping' dp_install_status_exit pass
dp_test_assert_status 1 'install warning exit mapping' dp_install_status_exit warning
dp_test_assert_status 2 'install critical exit mapping' dp_install_status_exit critical
dp_test_assert_status 70 'install invalid exit mapping' dp_install_status_exit invalid

text_one=$(dp_install_render_text plan)
text_two=$(dp_install_render_text plan)
dp_test_assert_eq "$text_one" "$text_two" 'deterministic text plan'
json_one=$(dp_install_render_json plan)
json_two=$(dp_install_render_json plan)
dp_test_assert_eq "$json_one" "$json_two" 'deterministic JSON plan'
dp_test_assert_contains "$json_one" '"apply_authorized": false' 'JSON apply authorization false'
dp_test_assert_contains "$json_one" '"host_modified": false' 'JSON host mutation false'
dp_test_assert_contains "$json_one" '"production_ready": false' 'JSON production readiness false'
plan[execution_authorization.summary]='safe "quoted" marker \\ value'
escaped_json=$(dp_install_render_json plan)
dp_test_assert_contains "$escaped_json" '\"quoted\"' 'JSON quote escaping'
dp_test_assert_contains "$escaped_json" '\\\\ value' 'JSON backslash escaping'

declare -A invalid_diagnostics=([overall_status]=pass) unchanged=([SENTINEL]=kept)
dp_install_build_plan invalid_diagnostics layout_evaluation package_inventory unchanged >/dev/null 2>&1 || true
dp_test_assert_eq kept "${unchanged[SENTINEL]}" 'failed plan build changed caller output'

for prohibited in hostname username group_id address environment credential; do
  dp_test_assert_not_contains "$text_one$json_one" "$prohibited" 'plan exposed prohibited host or secret field'
done

network_marker=$temp_dir/network-marker
for command_name in curl wget apt apt-get apt-cache; do
  printf '#!/bin/bash\nprintf invoked > "%s"\nexit 99\n' "$network_marker" > "$fake_bin/$command_name"
  chmod 0755 "$fake_bin/$command_name"
done
PATH=$fake_bin:$PATH dp_install_read_filesystem_manifest "$fixture_dir/filesystem-layout-valid.tsv" layout
[[ ! -e $network_marker ]] || dp_test_fail 'installation test invoked network or package mutation command'

dp_test_finish 'installation unit tests'
