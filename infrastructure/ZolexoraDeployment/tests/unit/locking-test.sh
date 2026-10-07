#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(git -C "$script_dir" rev-parse --show-toplevel)
# shellcheck source=../lib/test-helpers.sh
source "$repo_root/tests/lib/test-helpers.sh"
# shellcheck source=../../core/lib/locking.sh
source "$repo_root/core/lib/locking.sh"

temp_dir=
dp_test_make_temp_dir temp_dir
trap 'dp_test_cleanup_temp_dir "$temp_dir"' EXIT
lock_path="$temp_dir/deployment.lock"

held_fd=
dp_test_assert_status 0 'lock acquisition failed' dp_lock_acquire "$lock_path" 0 held_fd
original_fd=$held_fd
[[ -e /proc/$$/fd/$held_fd ]] || dp_test_fail 'acquired descriptor is not open'

if bash -c '
  set -Eeuo pipefail
  inherited_fd=$1
  exec {inherited_fd}>&-
  source "$2/core/lib/locking.sh"
  competing_fd=
  dp_lock_acquire "$3" "$4" competing_fd
' _ "$held_fd" "$repo_root" "$lock_path" 0; then
  competing_status=0
else
  competing_status=$?
fi
dp_test_assert_eq "$DP_EXIT_TEMPFAIL" "$competing_status" 'contending zero-timeout lock did not fail temporarily'

if bash -c '
  set -Eeuo pipefail
  inherited_fd=$1
  exec {inherited_fd}>&-
  source "$2/core/lib/locking.sh"
  competing_fd=
  dp_lock_acquire "$3" 1 competing_fd
' _ "$held_fd" "$repo_root" "$lock_path"; then
  bounded_status=0
else
  bounded_status=$?
fi
dp_test_assert_eq "$DP_EXIT_TEMPFAIL" "$bounded_status" 'bounded lock contention did not time out'

dp_test_assert_status 0 'lock release failed' dp_lock_release held_fd
[[ ! -v held_fd ]] || dp_test_fail 'released descriptor variable remains set'
[[ ! -e /proc/$$/fd/$original_fd ]] || dp_test_fail 'released descriptor remains open'
[[ -f $lock_path ]] || dp_test_fail 'lock release deleted the lock file'

after_fd=
dp_test_assert_status 0 'lock acquisition after release failed' dp_lock_acquire "$lock_path" 0 after_fd
dp_test_assert_status 0 'second lock release failed' dp_lock_release after_fd

fd=
dp_test_assert_status 0 'generic output variable did not receive a lock descriptor' dp_lock_acquire "$lock_path" 0 fd
dp_test_assert_status 0 'generic descriptor variable did not release' dp_lock_release fd

bad_fd=1
dp_test_assert_status "$DP_EXIT_DATAERR" 'unowned descriptor was released' dp_lock_release bad_fd
printf '' >/dev/null || dp_test_fail 'stdout was closed by invalid release'
dp_test_assert_status "$DP_EXIT_DATAERR" 'already released descriptor was accepted' dp_lock_release after_fd
dp_test_assert_status "$DP_EXIT_DATAERR" 'negative timeout was accepted' dp_lock_acquire "$lock_path" -1 invalid_fd
dp_test_assert_status "$DP_EXIT_DATAERR" 'oversized timeout was accepted' dp_lock_acquire "$lock_path" 301 invalid_fd
dp_test_assert_status "$DP_EXIT_NOINPUT" 'missing lock parent returned wrong status' dp_lock_acquire "$temp_dir/missing/lock" 0 invalid_fd

ln -s -- "$lock_path" "$temp_dir/symlink.lock"
dp_test_assert_status "$DP_EXIT_DATAERR" 'symlinked lock was accepted' dp_lock_acquire "$temp_dir/symlink.lock" 0 invalid_fd
if PATH=/nonexistent dp_lock_acquire "$lock_path" 0 invalid_fd; then missing_flock_status=0; else missing_flock_status=$?; fi
dp_test_assert_eq "$DP_EXIT_UNAVAILABLE" "$missing_flock_status" 'missing flock returned wrong status'

dp_test_finish 'locking unit tests'
