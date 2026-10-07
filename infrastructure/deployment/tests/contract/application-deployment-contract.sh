#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(git -C "$script_dir" rev-parse --show-toplevel)
compose_file=$repo_root/applications/marketplace/compose.yaml
example_file=$repo_root/applications/marketplace/config.example

# shellcheck source=../../core/lib/runtime.sh
source "$repo_root/core/lib/runtime.sh"
# shellcheck source=../../core/lib/validation.sh
source "$repo_root/core/lib/validation.sh"
# shellcheck source=../../core/lib/config.sh
source "$repo_root/core/lib/config.sh"

fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }

[[ -s $compose_file && ! -x $compose_file && $(stat -c '%a' -- "$compose_file") == 644 ]] || fail 'Compose contract mode or content is invalid'
[[ -s $example_file && ! -x $example_file && $(stat -c '%a' -- "$example_file") == 644 ]] || fail 'example configuration mode or content is invalid'
[[ $(stat -c '%a' -- "$repo_root/docs/decisions/0009-application-deployment-contract.md") == 644 ]] || fail 'ADR mode is invalid'

if command -v python3 >/dev/null 2>&1 && python3 -c 'import yaml' >/dev/null 2>&1; then
  python3 - "$compose_file" <<'PY' || exit 1
import sys, yaml
with open(sys.argv[1], encoding="utf-8") as stream:
    model = yaml.safe_load(stream)
assert "version" not in model
assert model["services"] == {}
assert model["volumes"] == {}
assert model["secrets"] == {}
assert model["networks"]["application"]["internal"] is True
assert model["networks"]["data"]["internal"] is True
contract = model["x-zolexora-contract"]
assert contract["deployment_enabled"] is False
assert contract["production_ready"] is False
assert contract["confirmed_services"] == []
assert contract["long_running_service_policy"]["cap_drop"] == ["ALL"]
assert contract["long_running_service_policy"]["security_opt"] == ["no-new-privileges:true"]
assert contract["long_running_service_policy"]["privileged"] is False
assert contract["long_running_service_policy"]["read_only"] is True
assert contract["migration_policy"]["automatic_schema_rollback"] is False
PY
else
  command -v docker >/dev/null 2>&1 || fail 'no existing Compose/YAML parser is available'
  docker compose version >/dev/null 2>&1 || fail 'Docker Compose v2 is unavailable'
fi

allowed=(COMPOSE_PROJECT_NAME UNRESOLVED_SERVICE_IMAGE_REFERENCE)
declare -A config=()
dp_config_load "$example_file" allowed config || fail 'example configuration is not literal allowlisted data'
[[ ${config[COMPOSE_PROJECT_NAME]-} == marketplace-contract-example ]] || fail 'example project name differs'
dp_is_valid_image_reference "${config[UNRESOLVED_SERVICE_IMAGE_REFERENCE]-}" || fail 'example image shape is not immutable'
[[ ${config[UNRESOLVED_SERVICE_IMAGE_REFERENCE]} == *@sha256:* ]] || fail 'example image is not digest-qualified'
for invalid_image in '' registry.invalid/zolexora/unresolved registry.invalid/zolexora/unresolved:contract registry.invalid/zolexora/unresolved:latest registry.invalid/zolexora/unresolved@sha256:short; do
  ! dp_is_valid_image_reference "$invalid_image" || fail 'mutable or malformed image reference was accepted'
done

executable=$(sed -E '/^[[:space:]]*#/d; /^[[:space:]]*$/d' "$compose_file")
for forbidden in '^[[:space:]]*version:' '^[[:space:]]*build:' ':[[:space:]]*latest([[:space:]]|$)' '^[[:space:]]*ports:' 'privileged:[[:space:]]*true' 'network_mode:[[:space:]]*host' 'cap_add:' '/var/run/docker.sock' '/data([/:]|$)' '/home/' '/\.ssh/' 'container_name:' '^[[:space:]]*links:' 'nginx' 'certbot'; do
  ! grep -Eiq -- "$forbidden" <<< "$executable" || fail "forbidden Compose contract content: $forbidden"
done

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  docker compose --env-file "$example_file" -f "$compose_file" config --quiet >/dev/null
fi

for option in --apply --execute --install --fix --repair --resume --recover; do
  set +e
  "$repo_root/install.sh" "$option" >/dev/null 2>&1
  status=$?
  set -e
  [[ $status -eq 64 ]] || fail "public installer option became available: $option"
done
for command_name in deploy rollback backup restore verify-backup healthcheck; do
  set +e
  "$repo_root/$command_name.sh" >/dev/null 2>&1
  status=$?
  set -e
  [[ $status -eq 78 ]] || fail "placeholder command became active: $command_name.sh"
done

printf 'PASS: application deployment contract tests\n'
