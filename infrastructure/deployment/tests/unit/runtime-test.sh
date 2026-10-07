#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(git -C "$script_dir" rev-parse --show-toplevel)
# shellcheck source=../lib/test-helpers.sh
source "$repo_root/tests/lib/test-helpers.sh"
# shellcheck source=../../core/lib/runtime.sh
source "$repo_root/core/lib/runtime.sh"

temp_dir=
dp_test_make_temp_dir temp_dir
trap 'dp_test_cleanup_temp_dir "$temp_dir"' EXIT

dp_test_assert_eq 0 "$DP_EXIT_SUCCESS" 'success exit code differs'
dp_test_assert_eq 64 "$DP_EXIT_USAGE" 'usage exit code differs'
dp_test_assert_eq 65 "$DP_EXIT_DATAERR" 'data-error exit code differs'
dp_test_assert_eq 66 "$DP_EXIT_NOINPUT" 'no-input exit code differs'
dp_test_assert_eq 69 "$DP_EXIT_UNAVAILABLE" 'unavailable exit code differs'
dp_test_assert_eq 70 "$DP_EXIT_SOFTWARE" 'software exit code differs'
dp_test_assert_eq 73 "$DP_EXIT_CANTCREAT" 'cannot-create exit code differs'
dp_test_assert_eq 74 "$DP_EXIT_IOERR" 'I/O exit code differs'
dp_test_assert_eq 75 "$DP_EXIT_TEMPFAIL" 'temporary-failure exit code differs'
dp_test_assert_eq 77 "$DP_EXIT_NOPERM" 'permission exit code differs'
dp_test_assert_eq 78 "$DP_EXIT_CONFIG" 'configuration exit code differs'

dp_log INFO 'visible message' 2>"$temp_dir/info.log"
info_output=$(<"$temp_dir/info.log")
dp_test_assert_contains "$info_output" 'INFO: visible message' 'INFO log record is malformed'

dp_log DEBUG 'filtered message' 2>"$temp_dir/debug.log"
dp_test_assert_eq '' "$(<"$temp_dir/debug.log")" 'DEBUG should be filtered at INFO level'
dp_test_assert_status "$DP_EXIT_DATAERR" 'unknown log level was accepted' dp_log_set_level TRACE
dp_log_set_level DEBUG
dp_log DEBUG 'debug message' 2>"$temp_dir/debug-enabled.log"
dp_test_assert_contains "$(<"$temp_dir/debug-enabled.log")" 'DEBUG: debug message' 'DEBUG level was not enabled'

fake_sensitive='fake-sensitive-value'
dp_log_field ERROR sample_field "$fake_sensitive" secret 2>"$temp_dir/redacted.log"
redacted_output=$(<"$temp_dir/redacted.log")
dp_test_assert_contains "$redacted_output" '[REDACTED]' 'secret field was not redacted'
dp_test_assert_not_contains "$redacted_output" "$fake_sensitive" 'secret field leaked its input'
dp_test_assert_status "$DP_EXIT_DATAERR" 'unknown field classification was accepted' dp_log_field INFO field value private
dp_test_assert_eq '[REDACTED]' "$(dp_redact "$fake_sensitive")" 'redaction output differs'

dp_test_assert_status 0 'bash command was not found' dp_command_exists bash
dp_test_assert_status 1 'missing command was reported available' dp_command_exists zolexora-command-that-does-not-exist

if (dp_die 70 'controlled failure') 2>"$temp_dir/die.log"; then die_status=0; else die_status=$?; fi
dp_test_assert_eq 70 "$die_status" 'dp_die returned the wrong exit status'
dp_test_assert_contains "$(<"$temp_dir/die.log")" 'ERROR: controlled failure' 'dp_die did not log its message'
dp_test_assert_status "$DP_EXIT_DATAERR" 'invalid fatal exit code was accepted' dp_die 0 invalid

source "$repo_root/core/lib/runtime.sh"
dp_test_finish 'runtime unit tests'
