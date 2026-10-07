#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(git -C "$script_dir" rev-parse --show-toplevel)
# shellcheck source=../lib/test-helpers.sh
source "$repo_root/tests/lib/test-helpers.sh"
cd -- "$repo_root"

[[ -x doctor.sh ]] || dp_test_fail 'doctor.sh is missing or non-executable'
bash -n doctor.sh || dp_test_fail 'doctor.sh syntax is invalid'
dp_test_assert_eq 755 "$(stat -c '%a' doctor.sh)" 'doctor.sh mode'
[[ -s core/lib/diagnostics.sh && ! -x core/lib/diagnostics.sh ]] || dp_test_fail 'diagnostics library mode or presence'
bash -n core/lib/diagnostics.sh || dp_test_fail 'diagnostics library syntax is invalid'
dp_test_assert_eq 644 "$(stat -c '%a' core/lib/diagnostics.sh)" 'diagnostics library mode'

help_output=$(./doctor.sh --help)
dp_test_assert_contains "$help_output" 'Usage: doctor.sh' 'doctor help output'
dp_test_silent_doctor() {
  ./doctor.sh "$@" >/dev/null 2>&1
}
dp_test_assert_status 64 'unknown option exit' dp_test_silent_doctor --unknown
dp_test_assert_status 64 'duplicate format exit' dp_test_silent_doctor --format text --format json
dp_test_assert_status 64 'missing format value exit' dp_test_silent_doctor --format
for option in --fix --install --repair --apply; do
  dp_test_assert_status 64 "remediation option rejected: $option" dp_test_silent_doctor "$option"
done

set +e
text_output=$(./doctor.sh --format text)
text_status=$?
json_output=$(./doctor.sh --format json)
json_status=$?
set -e
[[ $text_status == 0 || $text_status == 1 || $text_status == 2 ]] || dp_test_fail 'unauthorized text diagnostic exit code'
[[ $json_status == 0 || $json_status == 1 || $json_status == 2 ]] || dp_test_fail 'unauthorized JSON diagnostic exit code'
dp_test_assert_contains "$text_output" 'This diagnostic result does not certify the repository or host as production-ready.' 'text readiness warning'
dp_test_assert_contains "$json_output" '"production_ready": false' 'JSON readiness field'
dp_test_assert_eq 11 "$(grep -c '"id":' <<< "$json_output")" 'JSON check count'
for check_id in operating_system required_commands capacity filesystem docker docker_compose nginx systemd listeners time_sync dns; do
  dp_test_assert_eq 1 "$(grep -c "\"id\": \"$check_id\"" <<< "$json_output")" "JSON check occurrence: $check_id"
done
expected_order=$'operating_system\nrequired_commands\ncapacity\nfilesystem\ndocker\ndocker_compose\nnginx\nsystemd\nlisteners\ntime_sync\ndns'
actual_order=$(sed -n 's/.*"id": "\([^"]*\)".*/\1/p' <<< "$json_output")
dp_test_assert_eq "$expected_order" "$actual_order" 'JSON check order'
dp_test_assert_not_contains "$json_output" $'\033' 'JSON ANSI output'
for prohibited_field in hostname username address pid process command_line container registry_credentials nameserver; do
  dp_test_assert_not_contains "$json_output" "\"$prohibited_field\"" "prohibited JSON field: $prohibited_field"
done
[[ $json_output == \{*$'\n'\} ]] || dp_test_fail 'JSON contains leading or trailing non-JSON text'

if command -v python3 >/dev/null 2>&1; then
  JSON_DOCUMENT=$json_output python3 -c 'import json, os; data=json.loads(os.environ["JSON_DOCUMENT"]); assert list(data)==["contract_version","overall_status","checks","production_ready"]; assert [c["id"] for c in data["checks"]]==["operating_system","required_commands","capacity","filesystem","docker","docker_compose","nginx","systemd","listeners","time_sync","dns"]; assert all(c["status"] in {"pass","warning","critical"} for c in data["checks"]); assert data["production_ready"] is False'
fi

executable_code=$(sed -E '/^[[:space:]]*#/d; /^[[:space:]]*$/d' doctor.sh core/lib/diagnostics.sh)
if grep -Eq '^[[:space:]]*(eval|sudo|rm|mkdir|touch|install|apt|apt-get|snap|pip|npm|ssh|curl|wget|ping|dig|host|nslookup|aws|oci|az|gcloud|gh|gitlab|cloudflare)([[:space:]]|$)' <<< "$executable_code"; then
  dp_test_fail 'doctor executable code contains a prohibited operation'
fi
if grep -Eq 'systemctl[[:space:]]+(start|stop|restart|reload|enable|disable|mask|daemon-reload)|docker[[:space:]]+(run|pull|build|push|rm)|nginx[[:space:]]+-[sT]' <<< "$executable_code"; then
  dp_test_fail 'doctor executable code contains service or container mutation'
fi
if grep -Eq '^[[:space:]]*(env|printenv)([[:space:]]|$)|/proc/[^/]+/environ' <<< "$executable_code"; then
  dp_test_fail 'doctor executable code enumerates the environment'
fi
dp_test_assert_not_contains "$executable_code" 'tests/fixtures' 'production diagnostic references fixtures'

for command_name in deploy rollback backup restore verify-backup healthcheck; do
  expected="ERROR: $command_name.sh is not implemented as of DP-07; no operation was performed."
  set +e
  output=$("./$command_name.sh" 2>&1)
  status=$?
  set -e
  dp_test_assert_eq 78 "$status" "$command_name fail-closed exit"
  dp_test_assert_eq "$expected" "$output" "$command_name fail-closed message"
done
dp_test_silent_install() { ./install.sh "$@" >/dev/null 2>&1; }
dp_test_assert_status 78 'install no-argument fail-closed exit' dp_test_silent_install

dp_test_finish 'doctor contract tests'
