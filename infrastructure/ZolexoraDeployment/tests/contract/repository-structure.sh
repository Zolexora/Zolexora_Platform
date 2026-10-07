#!/usr/bin/env bash
set -Eeuo pipefail

failures=0

pass() {
  printf 'PASS: %s\n' "$1"
}

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  failures=$((failures + 1))
}

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
if ! repo_root=$(git -C "$script_dir" rev-parse --show-toplevel 2>/dev/null); then
  printf 'FAIL: unable to resolve repository root\n' >&2
  exit 1
fi

if [[ ${repo_root##*/} != ZolexoraDeployment ]]; then
  printf 'FAIL: unexpected repository root name\n' >&2
  exit 1
fi
cd -- "$repo_root"
pass 'repository root resolved and validated'

repository_files() {
  git ls-files --cached --others --exclude-standard
}

required_directories=(
  .github
  adapters adapters/backup adapters/dns adapters/dns/cloudflare
  adapters/infrastructure adapters/registry adapters/tls adapters/tls/letsencrypt
  adapters/transport adapters/transport/ssh
  applications applications/marketplace
  core core/lib core/install
  docs docs/decisions docs/runbooks
  firewall nginx systemd templates tests tests/contract tests/lib tests/unit tests/integration
  tests/fixtures tests/fixtures/doctor tests/fixtures/install tests/fixtures/install/execution
)

required_files=(
  .gitignore AGENTS.md README.md versions.env
  install.sh deploy.sh rollback.sh backup.sh restore.sh verify-backup.sh healthcheck.sh doctor.sh
  .github/README.md
  adapters/README.md adapters/backup/README.md adapters/dns/README.md
  adapters/dns/cloudflare/README.md adapters/infrastructure/README.md
  adapters/registry/README.md adapters/tls/README.md adapters/tls/letsencrypt/README.md
  adapters/transport/README.md adapters/transport/ssh/README.md
  applications/README.md applications/marketplace/README.md
  applications/marketplace/compose.yaml applications/marketplace/config.example
  core/README.md core/lib/README.md
  docs/architecture.md docs/backup-and-restore.md docs/disaster-recovery.md
  docs/environments.md docs/migration-runbook.md docs/security.md
  docs/decisions/README.md docs/decisions/0001-provider-neutral-core.md
  docs/decisions/0002-immutable-releases.md docs/decisions/0003-root-command-boundary.md
  docs/decisions/0004-shared-shell-foundation.md
  docs/decisions/0005-read-only-host-diagnostics.md
  docs/decisions/0006-filesystem-and-installation-planning.md
  docs/decisions/0007-isolated-installer-execution.md
  docs/decisions/0008-pre-production-installer-qualification.md
  docs/decisions/0009-application-deployment-contract.md
  docs/runbooks/README.md firewall/README.md nginx/README.md systemd/README.md
  templates/README.md tests/README.md
  core/lib/runtime.sh core/lib/validation.sh core/lib/paths.sh core/lib/config.sh
  core/lib/locking.sh core/lib/release.sh core/lib/diagnostics.sh core/lib/installation.sh
  core/lib/installer-execution.sh
  core/install/README.md core/install/filesystem-layout.tsv core/install/ubuntu-packages.tsv
  tests/lib/test-helpers.sh
  tests/unit/runtime-test.sh tests/unit/validation-test.sh tests/unit/paths-test.sh
  tests/unit/config-test.sh tests/unit/locking-test.sh tests/unit/release-test.sh
  tests/unit/diagnostics-test.sh tests/contract/repository-structure.sh
  tests/contract/library-contract.sh tests/contract/doctor-contract.sh
  tests/contract/install-plan-contract.sh tests/unit/installation-test.sh tests/run.sh
  tests/fixtures/doctor/ubuntu-24.04-os-release
  tests/fixtures/doctor/ubuntu-26.04-os-release
  tests/fixtures/doctor/unsupported-os-release
  tests/fixtures/doctor/malformed-os-release tests/fixtures/doctor/cpuinfo
  tests/fixtures/doctor/meminfo tests/fixtures/doctor/ss-listeners.txt
  tests/fixtures/doctor/resolv.conf tests/fixtures/doctor/time-synchronized.txt
  tests/fixtures/doctor/time-unsynchronized.txt
  tests/fixtures/install/filesystem-layout-valid.tsv
  tests/fixtures/install/filesystem-layout-invalid.tsv
  tests/fixtures/install/ubuntu-packages-valid.tsv
  tests/fixtures/install/ubuntu-packages-invalid.tsv
  tests/fixtures/install/dpkg-installed.txt tests/fixtures/install/dpkg-partial.txt
  tests/fixtures/install/execution/complete-package-state.tsv
  tests/fixtures/install/execution/missing-package-state.tsv
  tests/fixtures/install/execution/partial-package-state.tsv
  tests/fixtures/install/execution/version-conflict-state.tsv
  tests/fixtures/install/execution/source-unresolved-state.tsv
  tests/fixtures/install/execution/valid-execution-plan.tsv
  tests/fixtures/install/execution/invalid-execution-plan.tsv
  tests/fixtures/install/execution/expected-journal.tsv
  tests/fixtures/install/execution/expected-recovery-plan.tsv
  tests/unit/installer-execution-test.sh tests/contract/installer-execution-contract.sh
  tests/integration/isolated-installer-test.sh tests/integration/disposable-ubuntu-test.sh
  tests/integration/preproduction-installer-qualification-test.sh
  tests/contract/application-deployment-contract.sh
)

before=$failures
for directory in "${required_directories[@]}"; do
  [[ -d $directory ]] || fail "missing required directory: $directory"
done
((failures == before)) && pass 'required DP-07 directories exist'

before=$failures
for file in "${required_files[@]}"; do
  if [[ ! -f $file ]]; then
    fail "missing required file: $file"
  elif [[ ! -s $file ]]; then
    fail "required file is empty: $file"
  elif ! git ls-files --cached --others --exclude-standard -- "$file" | grep -Fxq -- "$file"; then
    fail "required file is ignored or outside repository file set: $file"
  fi
done
((failures == before)) && pass 'required DP-09 files exist and are non-empty'

root_commands=(
  install.sh deploy.sh rollback.sh backup.sh restore.sh
  verify-backup.sh healthcheck.sh doctor.sh
)
before=$failures
for command in "${root_commands[@]}"; do
  [[ -x $command ]] || fail "root command is not executable: $command"
done
((failures == before)) && pass 'canonical root commands exist and are executable'

production_libraries=(
  core/lib/runtime.sh core/lib/validation.sh core/lib/paths.sh
  core/lib/config.sh core/lib/locking.sh core/lib/release.sh core/lib/diagnostics.sh
  core/lib/installation.sh core/lib/installer-execution.sh
)
executable_tests=(
  tests/contract/repository-structure.sh tests/contract/library-contract.sh
  tests/unit/runtime-test.sh tests/unit/validation-test.sh tests/unit/paths-test.sh
  tests/unit/config-test.sh tests/unit/locking-test.sh tests/unit/release-test.sh tests/run.sh
  tests/contract/doctor-contract.sh tests/unit/diagnostics-test.sh
  tests/contract/install-plan-contract.sh tests/unit/installation-test.sh
  tests/contract/installer-execution-contract.sh tests/unit/installer-execution-test.sh
  tests/integration/isolated-installer-test.sh tests/integration/disposable-ubuntu-test.sh
  tests/integration/preproduction-installer-qualification-test.sh
  tests/contract/application-deployment-contract.sh
)
before=$failures
for library in "${production_libraries[@]}"; do
  [[ ! -x $library && $(stat -c '%a' "$library") == 644 ]] || fail "production library mode is not 100644: $library"
done
[[ ! -x tests/lib/test-helpers.sh && $(stat -c '%a' tests/lib/test-helpers.sh) == 644 ]] || fail 'test helper mode is not 100644'
for test_file in "${executable_tests[@]}"; do
  [[ -x $test_file && $(stat -c '%a' "$test_file") == 755 ]] || fail "test mode is not 100755: $test_file"
done
((failures == before)) && pass 'DP-09 library and test modes are correct'

before=$failures
for contract_file in core/install/README.md core/install/filesystem-layout.tsv core/install/ubuntu-packages.tsv; do
  [[ -f $contract_file && -s $contract_file && ! -x $contract_file && $(stat -c '%a' "$contract_file") == 644 ]] || fail "installation contract mode or content is invalid: $contract_file"
done
((failures == before)) && pass 'DP-06 installation contracts are non-empty and non-executable'

before=$failures
while IFS= read -r fixture; do
  [[ -f $fixture && -s $fixture && ! -x $fixture && $(stat -c '%a' "$fixture") == 644 ]] || fail "fixture mode or content is invalid: $fixture"
done < <(find tests/fixtures/doctor tests/fixtures/install -type f -print | sort)
((failures == before)) && pass 'DP-07 fixtures are non-empty and non-executable'

if [[ -e update.sh ]]; then
  fail 'obsolete update.sh exists'
else
  pass 'obsolete update.sh is absent'
fi

before=$failures
for directory in scripts bin tools core; do
  [[ -d $directory ]] || continue
  for command in "${root_commands[@]}" update.sh; do
    if find "$directory" -type f -name "$command" -print -quit | grep -q .; then
      fail "duplicate public command under $directory: $command"
    fi
  done
done
((failures == before)) && pass 'no duplicate public commands exist'

if [[ -e github ]]; then
  fail 'obsolete top-level github directory exists'
else
  pass 'obsolete top-level github directory is absent'
fi

if [[ -s .github/README.md ]]; then
  pass 'GitHub adapter boundary is tracked'
else
  fail '.github/README.md is missing or empty'
fi

if [[ -d .github/workflows ]] && find .github/workflows -type f \( -name '*.yml' -o -name '*.yaml' \) -print -quit | grep -q .; then
  fail 'GitHub Actions workflow exists before DP-12'
else
  pass 'no GitHub Actions workflow exists'
fi

unexpected_compose_found=0
dockerfile_found=0
while IFS= read -r file; do
  [[ -f $file ]] || continue
  case ${file##*/} in
    *compose*.yml|*compose*.yaml)
      [[ $file == applications/marketplace/compose.yaml ]] || unexpected_compose_found=1
      ;;
    Dockerfile|Dockerfile.*) dockerfile_found=1 ;;
  esac
done < <(repository_files)
before=$failures
((unexpected_compose_found == 0)) || fail 'unauthorized Compose file exists outside the Marketplace contract'
((dockerfile_found == 0)) || fail 'Dockerfile exists before its implementation phase'
((failures == before)) && pass 'only the canonical DP-09 Compose contract exists and no Dockerfile exists'

real_env_found=0
unsafe_artifact_found=0
private_key_content_found=0
zero_byte_found=0
while IFS= read -r file; do
  [[ -f $file ]] || continue
  base=${file##*/}
  case $base in
    .env|.env.*)
      case $base in .env.example|*.env.example) ;; *) real_env_found=1 ;; esac
      ;;
  esac
  case $base in
    *.key|*.pem|*.p12|*.pfx|*.jks|*.keystore|id_rsa|id_ed25519|*.dump|*.pgdump|*.backup|*.sql.gz|*.sql.zst|*.bak|backup-*.tar|backup-*.tar.gz|backup-*.tar.zst)
      unsafe_artifact_found=1
      ;;
  esac
  if grep -IlEq -- '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----' "$file"; then
    private_key_content_found=1
  fi
  [[ -s $file ]] || zero_byte_found=1
done < <(repository_files)
((real_env_found == 0)) && pass 'no real environment file is tracked or visible' || fail 'real environment file is tracked or visible'
((unsafe_artifact_found == 0)) && pass 'no private-key or backup artifact is tracked or visible' || fail 'private-key or backup artifact is tracked or visible'
((private_key_content_found == 0)) && pass 'no private-key content signature is tracked or visible' || fail 'private-key content signature is tracked or visible'
((zero_byte_found == 0)) && pass 'no tracked or visible repository file is zero bytes' || fail 'tracked or visible repository file is zero bytes'

before=$failures
grep -Fxq 'DEPLOYMENT_CONTRACT_VERSION="1"' versions.env || fail 'deployment contract version is missing'
grep -Fxq 'REPOSITORY_LAYOUT_VERSION="1"' versions.env || fail 'repository layout version is missing'
grep -Fxq 'SHELL_LIBRARY_CONTRACT_VERSION="1"' versions.env || fail 'shell library contract version is missing'
grep -Fxq 'HOST_DIAGNOSTIC_CONTRACT_VERSION="1"' versions.env || fail 'host diagnostic contract version is missing'
grep -Fxq 'FILESYSTEM_CONTRACT_VERSION="1"' versions.env || fail 'filesystem contract version is missing'
grep -Fxq 'INSTALLATION_PLAN_CONTRACT_VERSION="1"' versions.env || fail 'installation plan contract version is missing'
grep -Fxq 'INSTALLER_EXECUTION_CONTRACT_VERSION="1"' versions.env || fail 'installer execution contract version is missing'
((failures == before)) && pass 'repository contract versions are correct'

mutable_image_found=0
while IFS= read -r file; do
  [[ -f $file ]] || continue
  case $file in
    *.yml|*.yaml|*.env|*.conf|*.json)
      if grep -Eq '(^|[[:space:]])image:[[:space:]]*[^[:space:]]*:latest([[:space:]]|$)|(^|[[:space:]])[A-Za-z_][A-Za-z0-9_]*IMAGE[A-Za-z0-9_]*=[^[:space:]]*:latest([[:space:]]|$)' "$file"; then
        mutable_image_found=1
      fi
      ;;
  esac
done < <(repository_files)
((mutable_image_found == 0)) && pass 'no mutable production image reference exists in configuration' || fail 'mutable production image reference found in configuration'

provider_command_found=0
core_executables=("${root_commands[@]}")
while IFS= read -r file; do
  core_executables+=("$file")
done < <(find core -type f -perm /111 -print)
for file in "${core_executables[@]}"; do
  if grep -Eq '^[[:space:]]*(aws|oci|az|gcloud|gh|gitlab|cloudflare)([[:space:]]|$)' "$file"; then
    provider_command_found=1
  fi
done
((provider_command_found == 0)) && pass 'root and core executable code contain no provider CLI commands' || fail 'provider CLI command found in root or core executable code'

before=$failures
for command in deploy rollback backup restore verify-backup healthcheck; do
  expected="ERROR: $command.sh is not implemented as of DP-07; no operation was performed."
  set +e
  output=$("./$command.sh" 2>&1)
  status=$?
  set -e
  [[ $status -eq 78 ]] || fail "$command.sh does not fail closed with 78"
  [[ $output == "$expected" ]] || fail "$command.sh fail-closed message is incorrect"
done
set +e
./doctor.sh --help >/dev/null 2>&1
doctor_help_status=$?
./install.sh >/dev/null 2>&1
install_closed_status=$?
./install.sh --dry-run --format json >/dev/null 2>&1
install_plan_status=$?
set -e
[[ $doctor_help_status -eq 0 ]] || fail 'doctor.sh is not the operational DP-05 diagnostic command'
[[ $install_closed_status -eq 78 ]] || fail 'install.sh no-argument path does not fail closed'
[[ $install_plan_status -eq 0 || $install_plan_status -eq 1 || $install_plan_status -eq 2 ]] || fail 'install.sh dry-run returned an unauthorized status'
((failures == before)) && pass 'doctor and install dry-run are operational; six root commands fail closed'

readarray -t non_execution_libraries < <(find core/lib -maxdepth 1 -type f -name '*.sh' ! -name 'installer-execution.sh' -print | sort)
executable_code=$(sed -E '/^[[:space:]]*#/d; /^[[:space:]]*$/d' "${root_commands[@]}" "${non_execution_libraries[@]}")
if grep -Eq '^[[:space:]]*(sudo|apt|apt-get|snap|pip|npm|mkdir|touch|chown|chmod|useradd|groupadd|usermod|mount|umount)([[:space:]]|$)|systemctl[[:space:]]+(start|stop|restart|reload|enable|disable|mask|daemon-reload)' <<< "$executable_code"; then
  fail 'host-applying installation or remediation implementation exists in DP-07 public code'
else
  pass 'no host-applying installation or remediation implementation exists'
fi

if ((failures > 0)); then
  printf 'FAIL: repository structure contract has %d failure(s)\n' "$failures" >&2
  exit 1
fi

pass 'repository structure contract satisfied'
