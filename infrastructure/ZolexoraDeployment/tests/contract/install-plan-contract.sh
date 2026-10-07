#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(git -C "$script_dir" rev-parse --show-toplevel)
# shellcheck source=../lib/test-helpers.sh
source "$repo_root/tests/lib/test-helpers.sh"
cd -- "$repo_root"

[[ -x install.sh ]] || dp_test_fail 'install.sh is missing or non-executable'
dp_test_assert_eq 755 "$(stat -c '%a' install.sh)" 'install.sh mode'
bash -n install.sh || dp_test_fail 'install.sh syntax'
[[ -s core/lib/installation.sh && ! -x core/lib/installation.sh ]] || dp_test_fail 'installation library presence or executable mode'
dp_test_assert_eq 644 "$(stat -c '%a' core/lib/installation.sh)" 'installation library mode'
bash -n core/lib/installation.sh || dp_test_fail 'installation library syntax'

help_output=$(./install.sh --help)
dp_test_assert_contains "$help_output" 'Usage: install.sh --dry-run' 'install help'
dp_test_silent_install() { ./install.sh "$@" >/dev/null 2>&1; }
dp_test_assert_status 78 'install no-argument fail closed' dp_test_silent_install
dp_test_assert_status 64 'unknown install option' dp_test_silent_install --unknown
dp_test_assert_status 64 'duplicate format option' dp_test_silent_install --dry-run --format text --format json
dp_test_assert_status 64 'missing format value' dp_test_silent_install --dry-run --format
for option in --apply --install --fix --repair --execute --resume --recover; do
  dp_test_assert_status 64 "prohibited install option: $option" dp_test_silent_install "$option"
done

before_signature=$(find . -path './.git' -prune -o -type f -printf '%P %m %s %T@\n' | sort | sha256sum)
set +e
text_output=$(./install.sh --dry-run --format text)
text_status=$?
json_output=$(./install.sh --dry-run --format json)
json_status=$?
set -e
after_signature=$(find . -path './.git' -prune -o -type f -printf '%P %m %s %T@\n' | sort | sha256sum)
[[ $text_status == 0 || $text_status == 1 || $text_status == 2 ]] || dp_test_fail 'unauthorized text plan exit'
[[ $json_status == 0 || $json_status == 1 || $json_status == 2 ]] || dp_test_fail 'unauthorized JSON plan exit'
dp_test_assert_eq "$before_signature" "$after_signature" 'dry-run changed repository files'
dp_test_assert_contains "$text_output" 'No installation or host modification was performed.' 'text no-modification statement'
dp_test_assert_contains "$text_output" 'This plan does not authorize installation or certify production readiness.' 'text authorization warning'
dp_test_assert_eq 10 "$(grep -c '"id":' <<< "$json_output")" 'JSON step count'
expected_order=$'host_diagnostics\nfilesystem_contract\nfilesystem_existing_state\nservice_identity\nrequired_packages\npackage_versions\npackage_sources\nidempotency\ntransaction_boundaries\nexecution_authorization'
actual_order=$(sed -n 's/.*"id": "\([^"]*\)".*/\1/p' <<< "$json_output")
dp_test_assert_eq "$expected_order" "$actual_order" 'JSON step order'
dp_test_assert_contains "$json_output" '"apply_authorized": false' 'JSON apply false'
dp_test_assert_contains "$json_output" '"host_modified": false' 'JSON host modified false'
dp_test_assert_contains "$json_output" '"production_ready": false' 'JSON production ready false'

if command -v python3 >/dev/null 2>&1; then
  JSON_DOCUMENT=$json_output python3 -c 'import json, os; d=json.loads(os.environ["JSON_DOCUMENT"]); assert list(d)==["contract_version","mode","overall_status","steps","apply_authorized","host_modified","production_ready"]; assert len(d["steps"])==10; assert d["mode"]=="dry-run"; assert d["apply_authorized"] is d["host_modified"] is d["production_ready"] is False'
fi

executable_code=$(sed -E '/^[[:space:]]*#/d; /^[[:space:]]*$/d' install.sh core/lib/installation.sh)
if grep -Eq '^[[:space:]]*(eval|sudo|rm|mkdir|touch|chown|chmod|useradd|groupadd|usermod|mount|umount|ssh|curl|wget|ping|dig|host|nslookup|aws|oci|az|gcloud|gh|gitlab|cloudflare)([[:space:]]|$)' <<< "$executable_code"; then
  dp_test_fail 'installation executable code contains a prohibited operation'
fi
if grep -Eq 'apt(-get)?[[:space:]]+(update|install|upgrade|dist-upgrade|remove|purge)|systemctl[[:space:]]+(start|stop|restart|reload|enable|disable|mask|daemon-reload)|docker[[:space:]]+(run|pull|build|push|rm)|nginx[[:space:]]+-[sT]' <<< "$executable_code"; then
  dp_test_fail 'installation executable code contains mutation behavior'
fi
if grep -Eq '^[[:space:]]*(env|printenv)([[:space:]]|$)|/proc/[^/]+/environ' <<< "$executable_code"; then
  dp_test_fail 'installation executable code enumerates the environment'
fi

for command_name in deploy rollback backup restore verify-backup healthcheck; do
  expected="ERROR: $command_name.sh is not implemented as of DP-07; no operation was performed."
  set +e
  output=$("./$command_name.sh" 2>&1)
  status=$?
  set -e
  dp_test_assert_eq 78 "$status" "$command_name fail-closed exit"
  dp_test_assert_eq "$expected" "$output" "$command_name fail-closed message"
done

dp_test_finish 'installation plan contract tests'
