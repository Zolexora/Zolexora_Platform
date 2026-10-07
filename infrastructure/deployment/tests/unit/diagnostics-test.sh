#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(git -C "$script_dir" rev-parse --show-toplevel)
# shellcheck source=../lib/test-helpers.sh
source "$repo_root/tests/lib/test-helpers.sh"
# shellcheck source=../../core/lib/diagnostics.sh
source "$repo_root/core/lib/diagnostics.sh"

fixture_dir=$repo_root/tests/fixtures/doctor
temp_dir=
dp_test_make_temp_dir temp_dir
trap 'dp_test_cleanup_temp_dir "$temp_dir"' EXIT

source_dir=$temp_dir/source-check
mkdir -- "$source_dir"
if source_output=$(cd -- "$source_dir" && source "$repo_root/core/lib/diagnostics.sh" && source "$repo_root/core/lib/diagnostics.sh" 2>&1); then
  source_status=0
else
  source_status=$?
fi
dp_test_assert_eq 0 "$source_status" 'diagnostics repeated sourcing'
dp_test_assert_eq '' "$source_output" 'diagnostics source-time silence'
if find "$source_dir" -mindepth 1 -print -quit | grep -q .; then
  dp_test_fail 'diagnostics sourcing created a file'
fi

declare -A parsed=()
dp_diag_read_os_release "$fixture_dir/ubuntu-24.04-os-release" parsed
dp_test_assert_eq ubuntu "${parsed[ID]}" 'Ubuntu 24.04 ID parsing'
dp_test_assert_eq 24.04 "${parsed[VERSION_ID]}" 'Ubuntu 24.04 version parsing'
dp_diag_read_os_release "$fixture_dir/ubuntu-26.04-os-release" parsed
dp_test_assert_eq 26.04 "${parsed[VERSION_ID]}" 'Ubuntu 26.04 version parsing'

declare -A os_result=()
dp__diag_check_os "$fixture_dir/ubuntu-24.04-os-release" os_result
dp_test_assert_eq pass "${os_result[STATUS]}" 'Ubuntu 24.04 supported classification'
dp__diag_check_os "$fixture_dir/ubuntu-26.04-os-release" os_result
dp_test_assert_eq pass "${os_result[STATUS]}" 'Ubuntu 26.04 supported classification'
dp__diag_check_os "$fixture_dir/unsupported-os-release" os_result
dp_test_assert_eq critical "${os_result[STATUS]}" 'unsupported Ubuntu classification'

printf 'ID=debian\nVERSION_ID="13"\n' > "$temp_dir/non-ubuntu"
dp__diag_check_os "$temp_dir/non-ubuntu" os_result
dp_test_assert_eq critical "${os_result[STATUS]}" 'non-Ubuntu classification'
printf 'ID=ubuntu\n' > "$temp_dir/missing-version"
dp_test_assert_status "$DP_EXIT_DATAERR" 'missing OS field rejected' dp_diag_read_os_release "$temp_dir/missing-version" parsed
printf 'ID=ubuntu\nID=ubuntu\nVERSION_ID=24.04\n' > "$temp_dir/duplicate-os"
dp_test_assert_status "$DP_EXIT_DATAERR" 'duplicate OS field rejected' dp_diag_read_os_release "$temp_dir/duplicate-os" parsed
dp_test_assert_status "$DP_EXIT_DATAERR" 'malformed OS field rejected' dp_diag_read_os_release "$fixture_dir/malformed-os-release" parsed
marker=$temp_dir/non-execution-marker
printf 'ID=ubuntu\nVERSION_ID=24.04\nPRETTY_NAME="$(touch %s)"\n' "$marker" > "$temp_dir/shell-like-os"
dp_test_assert_status "$DP_EXIT_DATAERR" 'shell-like OS content rejected' dp_diag_read_os_release "$temp_dir/shell-like-os" parsed
[[ ! -e $marker ]] || dp_test_fail 'shell-like OS content executed'
parsed=([SENTINEL]=kept)
dp_diag_read_os_release "$fixture_dir/malformed-os-release" parsed >/dev/null 2>&1 || true
dp_test_assert_eq kept "${parsed[SENTINEL]}" 'failed OS parse changed caller output'

cpu_count=
dp_diag_read_cpu_count "$fixture_dir/cpuinfo" cpu_count
dp_test_assert_eq 2 "$cpu_count" 'CPU count parsing'
printf 'processor : malformed\n' > "$temp_dir/bad-cpuinfo"
dp_test_assert_status "$DP_EXIT_DATAERR" 'malformed CPU data rejected' dp_diag_read_cpu_count "$temp_dir/bad-cpuinfo" cpu_count
printf 'model name : no processor\n' > "$temp_dir/zero-cpuinfo"
dp_test_assert_status "$DP_EXIT_DATAERR" 'zero CPU count rejected' dp_diag_read_cpu_count "$temp_dir/zero-cpuinfo" cpu_count
dp_test_assert_status "$DP_EXIT_NOINPUT" 'missing CPU data rejected' dp_diag_read_cpu_count "$temp_dir/missing-cpuinfo" cpu_count

memory_kib=
dp_diag_read_memory_kib "$fixture_dir/meminfo" memory_kib
dp_test_assert_eq 4194304 "$memory_kib" 'memory parsing'
printf 'MemTotal: 4096 MB\n' > "$temp_dir/bad-meminfo"
dp_test_assert_status "$DP_EXIT_DATAERR" 'invalid memory unit rejected' dp_diag_read_memory_kib "$temp_dir/bad-meminfo" memory_kib
printf 'MemTotal: 9223372036854775808 kB\n' > "$temp_dir/overflow-meminfo"
dp_test_assert_status "$DP_EXIT_DATAERR" 'memory overflow rejected' dp_diag_read_memory_kib "$temp_dir/overflow-meminfo" memory_kib

safe_root="$temp_dir/managed root [fixture]"
mkdir -p -- "$safe_root"/{projects,backups,logs,secrets,ssl,scripts}
chmod 0755 "$safe_root"
declare -A filesystem=()
dp_diag_check_filesystem "$safe_root" filesystem
dp_test_assert_eq pass "${filesystem[STATUS]}" 'safe filesystem root accepted'
rmdir -- "$safe_root/scripts"
dp_diag_check_filesystem "$safe_root" filesystem
dp_test_assert_eq warning "${filesystem[STATUS]}" 'missing documented child warns'
mkdir -- "$safe_root/scripts"
ln -s -- "$temp_dir" "$safe_root/logs-link"
mv -- "$safe_root/logs" "$safe_root/logs-real"
mv -- "$safe_root/logs-link" "$safe_root/logs"
dp_diag_check_filesystem "$safe_root" filesystem
dp_test_assert_eq critical "${filesystem[STATUS]}" 'escaping child symlink rejected'
mv -- "$safe_root/logs" "$safe_root/logs-link"
mv -- "$safe_root/logs-real" "$safe_root/logs"
printf 'not a directory\n' > "$temp_dir/regular-root"
dp_diag_check_filesystem "$temp_dir/regular-root" filesystem
dp_test_assert_eq critical "${filesystem[STATUS]}" 'regular-file root rejected'
dp_diag_check_filesystem "$temp_dir/missing-root" filesystem
dp_test_assert_eq critical "${filesystem[STATUS]}" 'missing root rejected'
ln -s -- "$safe_root" "$temp_dir/root-symlink"
dp_diag_check_filesystem "$temp_dir/root-symlink" filesystem
dp_test_assert_eq critical "${filesystem[STATUS]}" 'root symlink rejected'
chmod 0777 "$safe_root"
dp_diag_check_filesystem "$safe_root" filesystem
dp_test_assert_eq critical "${filesystem[STATUS]}" 'world-writable root rejected'
chmod 0755 "$safe_root"
dp_test_assert_status "$DP_EXIT_DATAERR" 'prefix confusion rejected' dp_assert_safe_managed_path "$temp_dir/managed root [fixture]-other/child" "$safe_root"
chmod 0000 "$safe_root"
dp_diag_check_filesystem "$safe_root" filesystem
dp_test_assert_eq critical "${filesystem[STATUS]}" 'unreadable or unsearchable root rejected'
chmod 0755 "$safe_root"

fake_bin=$temp_dir/bin
mkdir -- "$fake_bin"
for command_name in "${DP_DIAG_REQUIRED_COMMANDS[@]}"; do
  printf '#!/bin/bash\nexit 0\n' > "$fake_bin/$command_name"
  chmod 0755 "$fake_bin/$command_name"
done
for command_name in docker nginx; do
  printf '#!/bin/bash\nexit 0\n' > "$fake_bin/$command_name"
  chmod 0755 "$fake_bin/$command_name"
done
declare -A inventory=()
PATH=$fake_bin dp_diag_inventory_commands inventory
dp_test_assert_eq pass "${inventory[STATUS]}" 'complete command inventory passes'
PATH=$temp_dir dp_diag_inventory_commands inventory
dp_test_assert_eq critical "${inventory[STATUS]}" 'missing commands become a diagnostic result'

dp__diag_parse_docker_version 'Docker version 29.1.2, build fixture' version
dp_test_assert_eq 29.1.2 "$version" 'Docker version normalization'
dp__diag_parse_compose_version 'Docker Compose version v2.40.0' version
dp_test_assert_eq 2.40.0 "$version" 'Compose version normalization'
dp__diag_parse_nginx_version 'nginx version: nginx/1.28.0' version
dp_test_assert_eq 1.28.0 "$version" 'Nginx version normalization'
dp_test_assert_status "$DP_EXIT_DATAERR" 'malformed Docker version rejected' dp__diag_parse_docker_version 'unexpected text' version

printf '#!/bin/bash\nif [[ $1 == --version ]]; then printf "systemd 257\\n"; else printf "degraded\\n"; exit 1; fi\n' > "$fake_bin/systemctl"
chmod 0755 "$fake_bin/systemctl"
declare -A service_result=()
PATH=$fake_bin dp__diag_check_systemd service_result
dp_test_assert_eq warning "${service_result[STATUS]}" 'degraded systemd classification'

listener_text=$(<"$fixture_dir/ss-listeners.txt")
declare -A listeners=()
dp_diag_parse_listener_text "$listener_text" listeners
dp_test_assert_eq 3 "${listeners[TCP_COUNT]}" 'TCP listener count'
dp_test_assert_eq 1 "${listeners[UDP_COUNT]}" 'UDP listener count'
dp_test_assert_eq 2 "${listeners[WILDCARD_COUNT]}" 'wildcard listener count'
dp_diag_parse_listener_text '' listeners
dp_test_assert_eq 0 "${listeners[TCP_COUNT]}" 'empty listener data accepted'
dp_test_assert_status "$DP_EXIT_DATAERR" 'malformed listener data rejected' dp_diag_parse_listener_text 'tcp malformed' listeners

time_value=$(<"$fixture_dir/time-synchronized.txt")
dp__diag_parse_time_sync "$time_value" || dp_test_fail 'synchronized time value rejected'
time_value=$(<"$fixture_dir/time-unsynchronized.txt")
dp__diag_parse_time_sync "$time_value" || dp_test_fail 'unsynchronized time value rejected'
dp_test_assert_status 1 'empty time value rejected' dp__diag_parse_time_sync ''
dp_test_assert_status 1 'malformed time value rejected' dp__diag_parse_time_sync maybe
dp__diag_resolver_configured "$fixture_dir/resolv.conf" || dp_test_fail 'resolver fixture rejected'
printf 'search fixture.invalid\n' > "$temp_dir/no-nameserver"
dp_test_assert_status 1 'missing resolver entry rejected' dp__diag_resolver_configured "$temp_dir/no-nameserver"
printf '#!/bin/bash\nexit 0\n' > "$fake_bin/getent"
chmod 0755 "$fake_bin/getent"
declare -A dns_result=()
PATH=$fake_bin dp__diag_check_dns "$fixture_dir/resolv.conf" dns_result
dp_test_assert_eq pass "${dns_result[STATUS]}" 'local hostname-resolution success'
printf '#!/bin/bash\nexit 1\n' > "$fake_bin/getent"
chmod 0755 "$fake_bin/getent"
PATH=$fake_bin dp__diag_check_dns "$fixture_dir/resolv.conf" dns_result
dp_test_assert_eq warning "${dns_result[STATUS]}" 'local hostname-resolution failure'

dp_test_assert_eq critical "$(dp__diag_worst_status pass warning critical pass)" 'severity aggregation'
dp_test_assert_status 0 'pass exit mapping' dp_diag_status_exit pass
dp_test_assert_status 1 'warning exit mapping' dp_diag_status_exit warning
dp_test_assert_status 2 'critical exit mapping' dp_diag_status_exit critical
dp_test_assert_status 70 'invalid status exit mapping' dp_diag_status_exit invalid

printf 'processor : 0\nprocessor : 1\n' > "$temp_dir/boundary-cpu"
printf 'MemTotal: 4194304 kB\n' > "$temp_dir/boundary-memory"
printf '#!/bin/bash\nprintf "Filesystem 1024-blocks Used Available Capacity Mounted on\\nfixture 41943040 20971520 20971520 50%%%% /fixture\\n"\n' > "$fake_bin/df"
chmod 0755 "$fake_bin/df"
declare -A capacity=()
PATH=$fake_bin:$PATH dp__diag_check_capacity "$temp_dir/boundary-cpu" "$temp_dir/boundary-memory" "$safe_root" capacity
dp_test_assert_eq pass "${capacity[STATUS]}" 'capacity baselines pass at boundary'
printf 'processor : 0\n' > "$temp_dir/low-cpu"
printf 'MemTotal: 4193280 kB\n' > "$temp_dir/low-memory"
printf '#!/bin/bash\nprintf "Filesystem 1024-blocks Used Available Capacity Mounted on\\nfixture 41943040 20972544 20970496 51%%%% /fixture\\n"\n' > "$fake_bin/df"
chmod 0755 "$fake_bin/df"
PATH=$fake_bin:$PATH dp__diag_check_capacity "$temp_dir/low-cpu" "$temp_dir/low-memory" "$safe_root" capacity
dp_test_assert_eq warning "${capacity[STATUS]}" 'below-baseline capacity warns'
PATH=$fake_bin:$PATH dp__diag_check_capacity "$temp_dir/missing-cpu" "$temp_dir/low-memory" "$safe_root" capacity
dp_test_assert_eq critical "${capacity[STATUS]}" 'missing capacity metric is critical'

declare -A rendered=()
for check_id in "${DP_DIAG_CHECK_IDS[@]}"; do
  rendered["$check_id.status"]=pass
  rendered["$check_id.summary"]='safe fixture summary'
done
rendered[overall_status]=pass
text_one=$(dp_diag_render_text rendered)
text_two=$(dp_diag_render_text rendered)
dp_test_assert_eq "$text_one" "$text_two" 'text rendering is deterministic'
dp_test_assert_contains "$text_one" 'does not certify the repository or host as production-ready' 'text readiness warning missing'
rendered[dns.summary]='safe "quoted" path \\ marker'
json_one=$(dp_diag_render_json rendered)
json_two=$(dp_diag_render_json rendered)
dp_test_assert_eq "$json_one" "$json_two" 'JSON rendering is deterministic'
dp_test_assert_contains "$json_one" '\"quoted\"' 'JSON quote escaping'
dp_test_assert_contains "$json_one" '\\\\ marker' 'JSON backslash escaping'
dp_test_assert_contains "$json_one" '"production_ready": false' 'JSON readiness field'
for prohibited in '192.0.2.' '127.0.0.1' '0.0.0.0' '[::]' 'non-execution-marker'; do
  dp_test_assert_not_contains "$text_one$json_one" "$prohibited" 'rendered diagnostics exposed prohibited fixture data'
done

if command -v python3 >/dev/null 2>&1; then
  JSON_DOCUMENT=$json_one python3 -c 'import json, os; data=json.loads(os.environ["JSON_DOCUMENT"]); assert list(data)==["contract_version","overall_status","checks","production_ready"]; assert len(data["checks"])==11; assert data["production_ready"] is False'
fi

dp_test_finish 'diagnostics unit tests'
