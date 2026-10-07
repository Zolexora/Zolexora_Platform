#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(git -C "$script_dir" rev-parse --show-toplevel)
# shellcheck source=../lib/test-helpers.sh
source "$repo_root/tests/lib/test-helpers.sh"
# shellcheck source=../../core/lib/config.sh
source "$repo_root/core/lib/config.sh"

temp_dir=
dp_test_make_temp_dir temp_dir
trap 'dp_test_cleanup_temp_dir "$temp_dir"' EXIT

allowed=(NAME DESCRIPTION OPTIONAL)
required=(NAME DESCRIPTION)
declare -A config=()
printf '# comment\r\nNAME=marketplace\r\nDESCRIPTION=value with spaces # literal\r\nOPTIONAL=\r\n' >"$temp_dir/valid.conf"
dp_test_assert_status 0 'valid configuration was rejected' dp_config_load "$temp_dir/valid.conf" allowed config
dp_test_assert_eq marketplace "${config[NAME]-}" 'NAME was parsed incorrectly'
dp_test_assert_eq 'value with spaces # literal' "${config[DESCRIPTION]-}" 'literal value was parsed incorrectly'
dp_test_assert_eq '' "${config[OPTIONAL]-missing}" 'empty value was parsed incorrectly'
dp_test_assert_status 0 'required keys were rejected' dp_config_require_keys config required
value=
dp_test_assert_status 0 'configuration lookup failed' dp_config_get config DESCRIPTION value
dp_test_assert_eq 'value with spaces # literal' "$value" 'configuration lookup returned wrong value'

printf 'NAME=one\nNAME=two\n' >"$temp_dir/duplicate.conf"
printf 'UNKNOWN=value\n' >"$temp_dir/unknown.conf"
printf 'NAME =value\n' >"$temp_dir/whitespace.conf"
printf 'NAME= value\n' >"$temp_dir/value-whitespace.conf"
printf 'export NAME=value\n' >"$temp_dir/export.conf"
printf 'NOT A CONFIG LINE\n' >"$temp_dir/malformed.conf"
for file in duplicate unknown whitespace value-whitespace export malformed; do
  config=([KEEP]=unchanged)
  dp_test_assert_status "$DP_EXIT_CONFIG" 'invalid configuration returned wrong status' dp_config_load "$temp_dir/$file.conf" allowed config
  dp_test_assert_eq unchanged "${config[KEEP]-}" 'failed load changed destination state'
done

marker="$temp_dir/must-not-exist"
printf 'NAME=$(touch %s)\n' "$marker" >"$temp_dir/substitution.conf"
printf 'NAME=`touch %s`\n' "$marker" >"$temp_dir/backtick.conf"
printf '%s\n' 'NAME=${HOME}' >"$temp_dir/parameter.conf"
printf '%s\n' 'NAME=$HOME' >"$temp_dir/simple-parameter.conf"
for file in substitution backtick parameter simple-parameter; do
  config=([KEEP]=unchanged)
  dp_test_assert_status "$DP_EXIT_CONFIG" 'shell-like value was accepted' dp_config_load "$temp_dir/$file.conf" allowed config
done
[[ ! -e $marker ]] || dp_test_fail 'shell-like configuration value executed'

ln -s -- "$temp_dir/valid.conf" "$temp_dir/symlink.conf"
dp_test_assert_status "$DP_EXIT_NOINPUT" 'symlinked configuration was accepted' dp_config_load "$temp_dir/symlink.conf" allowed config
printf 'NAME=value\0extra' >"$temp_dir/nul.conf"
dp_test_assert_status "$DP_EXIT_CONFIG" 'NUL configuration content was accepted' dp_config_load "$temp_dir/nul.conf" allowed config
truncate -s 1048577 "$temp_dir/oversized.conf"
dp_test_assert_status "$DP_EXIT_CONFIG" 'oversized configuration was accepted' dp_config_load "$temp_dir/oversized.conf" allowed config

missing=(NAME MISSING)
config=([NAME]=marketplace)
dp_test_assert_status "$DP_EXIT_CONFIG" 'missing required key was accepted' dp_config_require_keys config missing
dp_test_assert_status "$DP_EXIT_NOINPUT" 'missing key lookup returned wrong status' dp_config_get config DESCRIPTION value

dp_test_finish 'configuration unit tests'
