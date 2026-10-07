#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(git -C "$script_dir" rev-parse --show-toplevel)
# shellcheck source=../lib/test-helpers.sh
source "$repo_root/tests/lib/test-helpers.sh"
# shellcheck source=../../core/lib/paths.sh
source "$repo_root/core/lib/paths.sh"

temp_dir=
outside_dir=
dp_test_make_temp_dir temp_dir
dp_test_make_temp_dir outside_dir
trap 'dp_test_cleanup_temp_dir "$temp_dir"; dp_test_cleanup_temp_dir "$outside_dir"' EXIT

mkdir -p -- "$temp_dir/child/nested" "$temp_dir/name with spaces;and-dollar$" "$temp_dir/app" "$temp_dir/application"
ln -s -- "$outside_dir" "$temp_dir/escape-link"
ln -s -- "$temp_dir/child" "$temp_dir/inside-link"
ln -s -- "$temp_dir/does-not-exist" "$temp_dir/broken-link"

dp_test_assert_eq "$temp_dir/child" "$(dp_path_canonicalize "$temp_dir/child")" 'canonical child path differs'
dp_test_assert_status 0 'valid child was rejected' dp_path_is_within "$temp_dir/child" "$temp_dir"
dp_test_assert_status 0 'valid nested child was rejected' dp_assert_safe_managed_path "$temp_dir/child/nested" "$temp_dir"
dp_test_assert_status 0 'missing future child was rejected' dp_assert_safe_managed_path "$temp_dir/future/child" "$temp_dir"
dp_test_assert_status 0 'quoted path with spaces or metacharacters was rejected' dp_assert_safe_managed_path "$temp_dir/name with spaces;and-dollar$" "$temp_dir"
dp_test_assert_status 0 'symlink contained within root was rejected' dp_assert_safe_managed_path "$temp_dir/inside-link/nested" "$temp_dir"

dp_test_assert_status "$DP_EXIT_DATAERR" 'empty path accepted' dp_path_canonicalize ''
dp_test_assert_status "$DP_EXIT_DATAERR" 'relative path accepted' dp_path_canonicalize relative/path
dp_test_assert_status "$DP_EXIT_DATAERR" 'root path accepted' dp_path_canonicalize /
dp_test_assert_status 0 'traversal was not detected' dp_path_contains_traversal "$temp_dir/child/../other"
dp_test_assert_status "$DP_EXIT_DATAERR" 'traversal path was canonicalized' dp_path_canonicalize "$temp_dir/child/../other"
dp_test_assert_status 1 'prefix-confused outside path accepted' dp_path_is_within "$temp_dir/application" "$temp_dir/app"
dp_test_assert_status "$DP_EXIT_DATAERR" 'escaping symlink accepted' dp_assert_safe_managed_path "$temp_dir/escape-link/child" "$temp_dir"
dp_test_assert_status "$DP_EXIT_DATAERR" 'broken symlink component accepted' dp_assert_safe_managed_path "$temp_dir/broken-link/child" "$temp_dir"
dp_test_assert_status "$DP_EXIT_DATAERR" 'root accepted as allowed root' dp_assert_safe_managed_path / /

dp_test_assert_status 0 'valid destructive child rejected' dp_assert_safe_destructive_target "$temp_dir/child" "$temp_dir"
dp_test_assert_status "$DP_EXIT_DATAERR" 'allowed root accepted as destructive target' dp_assert_safe_destructive_target "$temp_dir" "$temp_dir"
dp_test_assert_status "$DP_EXIT_NOINPUT" 'missing destructive target returned wrong status' dp_assert_safe_destructive_target "$temp_dir/missing" "$temp_dir"
dp_test_assert_status "$DP_EXIT_NOINPUT" 'symlink destructive target returned wrong status' dp_assert_safe_destructive_target "$temp_dir/inside-link" "$temp_dir"
dp_test_assert_status "$DP_EXIT_DATAERR" '/data accepted as destructive target' dp_assert_safe_destructive_target /data /
dp_test_assert_status "$DP_EXIT_DATAERR" 'home accepted as destructive target' dp_assert_safe_destructive_target "${HOME:-/nonexistent-home}" /

dp_test_finish 'path unit tests'
