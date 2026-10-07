#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(git -C "$script_dir" rev-parse --show-toplevel)
# shellcheck source=../lib/test-helpers.sh
source "$repo_root/tests/lib/test-helpers.sh"
# shellcheck source=../../core/lib/validation.sh
source "$repo_root/core/lib/validation.sh"

for value in marketplace marketplace-api worker-2 a; do
  dp_test_assert_status 0 "valid identifier rejected: $value" dp_is_valid_identifier "$value"
done
for value in '' Marketplace -marketplace marketplace- market/place marketplace_api .. two--hyphens 'has space' 'bad;value'; do
  dp_test_assert_status 1 'invalid identifier was accepted' dp_is_valid_identifier "$value"
done
dp_test_assert_status "$DP_EXIT_DATAERR" 'required invalid identifier returned wrong status' dp_require_identifier Marketplace application

dp_test_assert_status 0 'valid configuration key rejected' dp_is_valid_config_key MARKETPLACE_API_2
dp_test_assert_status 1 'lowercase configuration key accepted' dp_is_valid_config_key marketplace
long_key=A$(printf '%0128d' 0)
dp_test_assert_status 1 'oversized configuration key accepted' dp_is_valid_config_key "$long_key"

for value in 0 8 0008 9223372036854775807; do
  dp_test_assert_status 0 'valid unsigned integer rejected' dp_is_valid_uint "$value"
done
for value in '' -1 +1 1.0 ' 1' 0x10 9223372036854775808; do
  dp_test_assert_status 1 'invalid unsigned integer accepted' dp_is_valid_uint "$value"
done
dp_test_assert_status 0 'leading-zero decimal range failed' dp_require_uint_range 0008 0 10 timeout
dp_test_assert_status "$DP_EXIT_DATAERR" 'out-of-range integer accepted' dp_require_uint_range 11 0 10 timeout

sha=0123456789abcdef0123456789abcdef01234567
digest=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789
dp_test_assert_status 0 'full release SHA rejected' dp_is_valid_release_id "$sha"
for value in 01234567 ABCDEF0123456789ABCDEF0123456789ABCDEF01 main latest 'bad value'; do
  dp_test_assert_status 1 'invalid release identifier accepted' dp_is_valid_release_id "$value"
done

dp_test_assert_status 0 'SHA-tagged image rejected' dp_is_valid_image_reference "ghcr.io/zolexora/marketplace-api:$sha"
dp_test_assert_status 0 'digest-pinned image rejected' dp_is_valid_image_reference "registry.example.com:5000/team/app@sha256:$digest"
for value in ghcr.io/Zolexora/app:$sha ghcr.io/zolexora/app:latest ghcr.io/zolexora/app:1.2.3 ghcr.io/zolexora/app:01234567 "ghcr.io/zolexora/app@sha256:short" 'ghcr.io/team/app:bad;command' 'ghcr.io/team/app'; do
  dp_test_assert_status 1 'mutable or malformed image accepted' dp_is_valid_image_reference "$value"
done

dp_test_assert_status 0 'valid leap-day timestamp rejected' dp_is_valid_rfc3339_utc 2024-02-29T23:59:59Z
for value in 2023-02-29T00:00:00Z 2024-13-01T00:00:00Z 2024-01-01T24:00:00Z 2024-01-01T00:00:00+00:00 '2024-01-01 00:00:00Z'; do
  dp_test_assert_status 1 'invalid timestamp accepted' dp_is_valid_rfc3339_utc "$value"
done

dp_test_finish 'validation unit tests'
