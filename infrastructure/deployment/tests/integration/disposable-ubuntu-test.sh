#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(cd -- "$script_dir/../.." && pwd -P)

if [[ ${ZOLEXORA_DISPOSABLE_TEST_ENVIRONMENT:-} != development && ${ZOLEXORA_DISPOSABLE_TEST_ENVIRONMENT:-} != test ]]; then
  printf 'SKIP: disposable Ubuntu validation requires explicit development/test host classification\n'
  exit 77
fi
command -v docker >/dev/null 2>&1 || { printf 'SKIP: Docker is unavailable\n'; exit 77; }
docker version --format '{{.Server.Version}}' >/dev/null 2>&1 || { printf 'SKIP: Docker daemon access is unavailable\n'; exit 77; }

for image in ubuntu:24.04 ubuntu:26.04; do
  docker image inspect "$image" >/dev/null 2>&1 || { printf 'SKIP: required local Ubuntu image is unavailable\n'; exit 77; }
done

for image in ubuntu:24.04 ubuntu:26.04; do
  docker run --rm --pull=never --network none --cap-drop ALL --security-opt no-new-privileges \
    --read-only --tmpfs /tmp:rw,nosuid,nodev,mode=1777 \
    --mount "type=bind,src=$repo_root,dst=/workspace,readonly" \
    "$image" /bin/bash /workspace/tests/integration/isolated-installer-test.sh >/dev/null
done
printf 'PASS: disposable Ubuntu 24.04 and 26.04 installer tests\n'
