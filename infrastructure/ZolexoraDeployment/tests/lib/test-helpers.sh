#!/usr/bin/env bash

if [[ ${DP_TEST_HELPERS_SH_LOADED:-0} == 1 ]]; then
  return 0 2>/dev/null || exit 0
fi
readonly DP_TEST_HELPERS_SH_LOADED=1

DP_TEST_FAILURES=0

dp_test_pass() {
  printf 'PASS: %s\n' "$1"
}

dp_test_fail() {
  printf 'FAIL: %s\n' "$1" >&2
  DP_TEST_FAILURES=$((DP_TEST_FAILURES + 1))
}

dp_test_assert_eq() {
  [[ $# -eq 3 ]] || { dp_test_fail 'invalid equality assertion'; return; }
  [[ $1 == "$2" ]] || dp_test_fail "$3"
}

dp_test_assert_status() {
  [[ $# -ge 3 ]] || { dp_test_fail 'invalid status assertion'; return; }
  local expected=$1 label=$2 status
  shift 2
  if "$@"; then status=0; else status=$?; fi
  [[ $status -eq $expected ]] || dp_test_fail "$label"
}

dp_test_assert_contains() {
  [[ $# -eq 3 ]] || { dp_test_fail 'invalid contains assertion'; return; }
  [[ $1 == *"$2"* ]] || dp_test_fail "$3"
}

dp_test_assert_not_contains() {
  [[ $# -eq 3 ]] || { dp_test_fail 'invalid exclusion assertion'; return; }
  [[ $1 != *"$2"* ]] || dp_test_fail "$3"
}

dp_test_make_temp_dir() {
  [[ $# -eq 1 && $1 =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || { dp_test_fail 'invalid temporary-directory output variable'; return; }
  local created
  created=$(mktemp -d /tmp/zolexora-dp04.XXXXXX) || { dp_test_fail 'unable to create test temporary directory'; return; }
  printf -v "$1" '%s' "$created"
}

dp_test_make_isolation_root() {
  [[ $# -eq 1 && $1 =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || { dp_test_fail 'invalid isolation-root output variable'; return; }
  local created marker
  created=$(mktemp -d /tmp/zolexora-dp07.XXXXXX) || { dp_test_fail 'unable to create isolation root'; return; }
  marker=$created/.zolexora-dp07-isolation
  printf '%s\n' ZOLEXORA_DP07_ISOLATION_ROOT_V1 > "$marker" || { rmdir -- "$created"; dp_test_fail 'unable to mark isolation root'; return; }
  chmod 0600 -- "$marker"
  printf -v "$1" '%s' "$created"
}

dp_test_cleanup_temp_dir() {
  [[ $# -eq 1 ]] || { dp_test_fail 'invalid cleanup request'; return; }
  local target=$1 repository_root home_path
  repository_root=$(git rev-parse --show-toplevel 2>/dev/null) || repository_root=/nonexistent-repository
  home_path=${HOME:-/nonexistent-home}
  if [[ -z $target || $target == / || $target == /tmp || $target == "$repository_root" || $target == "$home_path" || ! -d $target || -L $target || ! -O $target ]]; then
    dp_test_fail 'refused unsafe temporary-directory cleanup'
    return
  fi
  case $target in
    /tmp/zolexora-dp04.*) ;;
    /tmp/zolexora-dp07.*)
      [[ -f $target/.zolexora-dp07-isolation && ! -L $target/.zolexora-dp07-isolation && $(<"$target/.zolexora-dp07-isolation") == ZOLEXORA_DP07_ISOLATION_ROOT_V1 ]] || { dp_test_fail 'refused unmarked isolation-root cleanup'; return; }
      ;;
    *) dp_test_fail 'refused unknown temporary-directory namespace'; return ;;
  esac
  rm -rf -- "$target"
}

dp_test_finish() {
  [[ $# -eq 1 ]] || return 1
  if ((DP_TEST_FAILURES > 0)); then
    printf 'FAIL: %s (%d failure(s))\n' "$1" "$DP_TEST_FAILURES" >&2
    return 1
  fi
  dp_test_pass "$1"
}
