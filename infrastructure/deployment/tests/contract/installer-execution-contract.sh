#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(git -C "$script_dir" rev-parse --show-toplevel)
# shellcheck source=../lib/test-helpers.sh
source "$repo_root/tests/lib/test-helpers.sh"
cd -- "$repo_root"

library=core/lib/installer-execution.sh
[[ -s $library && ! -x $library ]] || dp_test_fail 'installer-execution library presence or mode'
dp_test_assert_eq 644 "$(stat -c '%a' "$library")" 'installer-execution library mode'
bash -n "$library" || dp_test_fail 'installer-execution library syntax'

source_output=$(bash -c 'source "$1"; source "$1"' -- "$library" 2>&1)
dp_test_assert_eq '' "$source_output" 'installer-execution source-time silence'
for dependency in runtime validation paths diagnostics installation installer-execution; do
  # shellcheck disable=SC1090
  source "$repo_root/core/lib/$dependency.sh"
done

executable_code=$(sed -E '/^[[:space:]]*#/d; /^[[:space:]]*$/d' "$library")
if grep -Eq '^[[:space:]]*(sudo|eval|apt|apt-get|dpkg|snap|pip|npm|systemctl|service|docker|ssh|curl|wget|ping|dig|host|nslookup|aws|oci|az|gcloud|gh|gitlab|cloudflare)([[:space:]]|$)' <<< "$executable_code"; then
  dp_test_fail 'execution library contains prohibited host or network command'
fi
for function_name in dp_exec_initialize_transaction dp_exec_apply_simulated_packages dp_exec_apply_filesystem_layout dp_exec_verify_postconditions dp_exec_record_completion dp_exec_cleanup_test_root; do
  function_body=$(sed -n "/^$function_name()/,/^}/p" "$library")
  grep -Eq 'dp__exec_(require|validate)_isolation_root|dp_exec_validate_isolation_root' <<< "$function_body" || dp_test_fail "mutation function lacks isolation validation: $function_name"
done

if rg -q 'dp_exec_|dp__exec_' doctor.sh install.sh deploy.sh rollback.sh backup.sh restore.sh verify-backup.sh healthcheck.sh; then
  dp_test_fail 'public root command references installer execution engine'
fi
dp_test_assert_status 78 'install no-argument exit' bash -c './install.sh >/dev/null 2>&1'
no_arg=$(./install.sh 2>&1 || true)
dp_test_assert_eq 'ERROR: install.sh is not implemented for host installation as of DP-07; no operation was performed.' "$no_arg" 'install no-argument message'
for option in --apply --execute --install --fix --repair --resume --recover; do dp_test_assert_status 64 "rejected option: $option" bash -c './install.sh "$1" >/dev/null 2>&1' -- "$option"; done
dp_test_assert_status 0 'install help' bash -c './install.sh --help >/dev/null'
set +e
./install.sh --dry-run --format json >/dev/null
dry_status=$?
set -e
[[ $dry_status == 0 || $dry_status == 1 || $dry_status == 2 ]] || dp_test_fail 'install dry-run status'

execution_root=
dp_test_make_isolation_root execution_root
trap '[[ ! -d $execution_root ]] || dp_test_cleanup_temp_dir "$execution_root"' EXIT
cp -- tests/fixtures/install/execution/complete-package-state.tsv "$execution_root/package-input.tsv"
declare -A execution_plan=() execution_layout=() execution_report=()
dp_exec_read_plan tests/fixtures/install/execution/valid-execution-plan.tsv execution_plan
dp_install_read_filesystem_manifest core/install/filesystem-layout.tsv execution_layout
dp__exec_execute_isolated "$execution_root" execution_plan execution_layout execution_report
execution_json=$(dp_exec_render_json execution_report)
dp_test_assert_eq 10 "$(grep -c '"id":' <<< "$execution_json")" 'execution JSON step count'
for false_field in production_apply_authorized host_data_modified host_packages_modified production_ready; do dp_test_assert_contains "$execution_json" "\"$false_field\": false" "execution JSON false field: $false_field"; done
dp_test_assert_not_contains "$execution_json" "$execution_root" 'execution JSON exposed isolation root'

for command_name in deploy rollback backup restore verify-backup healthcheck; do
  set +e
  output=$("./$command_name.sh" 2>&1)
  status=$?
  set -e
  dp_test_assert_eq 78 "$status" "$command_name fail-closed exit"
  dp_test_assert_eq "ERROR: $command_name.sh is not implemented as of DP-07; no operation was performed." "$output" "$command_name fail-closed message"
done

repository_files=$(git ls-files --cached --others --exclude-standard)
while IFS= read -r repository_file; do
  case $repository_file in
    applications/marketplace/compose.yaml) ;;
    .github/workflows/*|.env|*/.env|Dockerfile|*/Dockerfile|Dockerfile.*|*/Dockerfile.*|*compose*.yml|*compose*.yaml)
      dp_test_fail "prohibited deployment artifact exists: $repository_file"
      ;;
  esac
done <<< "$repository_files"
[[ ! -e update.sh ]] || dp_test_fail 'update.sh reappeared'
if grep -IlEq -- '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----' $repository_files 2>/dev/null; then dp_test_fail 'private-key signature found'; fi

dp_test_finish 'installer execution contract tests'
