#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(git -C "$script_dir" rev-parse --show-toplevel)
# shellcheck source=../lib/test-helpers.sh
source "$repo_root/tests/lib/test-helpers.sh"
# shellcheck source=../../core/lib/release.sh
source "$repo_root/core/lib/release.sh"

temp_dir=
dp_test_make_temp_dir temp_dir
trap 'dp_test_cleanup_temp_dir "$temp_dir"' EXIT

sha=0123456789abcdef0123456789abcdef01234567
digest=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789
sha_image="ghcr.io/zolexora/marketplace-api:$sha"
digest_image="registry.example.com:5000/team/worker@sha256:$digest"
timestamp=2024-02-29T12:34:56Z

dp_test_assert_status 0 'SHA-tagged release was rejected' dp_release_validate marketplace "$sha" "$timestamp" "$sha_image"
dp_test_assert_status 0 'digest-pinned release was rejected' dp_release_validate marketplace "$sha" "$timestamp" "$digest_image"
dp_test_assert_status 0 'multiple-image release was rejected' dp_release_validate marketplace "$sha" "$timestamp" "$sha_image,$digest_image"

expected=$(printf 'APPLICATION_ID=marketplace\nRELEASE_ID=%s\nCREATED_AT_UTC=%s\nIMAGE_REFERENCES=%s' "$sha" "$timestamp" "$sha_image,$digest_image")
rendered=$(dp_release_metadata_render marketplace "$sha" "$timestamp" "$sha_image,$digest_image")
dp_test_assert_eq "$expected" "$rendered" 'release rendering is not deterministic'
dp_test_assert_eq "$rendered" "$(dp_release_metadata_render marketplace "$sha" "$timestamp" "$sha_image,$digest_image")" 'repeat rendering differs'

printf '%s\n' "$rendered" >"$temp_dir/release.conf"
declare -A loaded=()
dp_test_assert_status 0 'rendered release did not load' dp_release_metadata_load "$temp_dir/release.conf" loaded
dp_test_assert_eq marketplace "${loaded[APPLICATION_ID]-}" 'round-trip application differs'
dp_test_assert_eq "$sha" "${loaded[RELEASE_ID]-}" 'round-trip release differs'
dp_test_assert_eq "$timestamp" "${loaded[CREATED_AT_UTC]-}" 'round-trip timestamp differs'
dp_test_assert_eq "$sha_image,$digest_image" "${loaded[IMAGE_REFERENCES]-}" 'round-trip images differ'

dp_test_assert_status "$DP_EXIT_DATAERR" 'invalid application ID accepted' dp_release_validate Marketplace "$sha" "$timestamp" "$sha_image"
dp_test_assert_status "$DP_EXIT_DATAERR" 'short release SHA accepted' dp_release_validate marketplace 01234567 "$timestamp" "$sha_image"
dp_test_assert_status "$DP_EXIT_DATAERR" 'uppercase release SHA accepted' dp_release_validate marketplace "${sha^^}" "$timestamp" "$sha_image"
dp_test_assert_status "$DP_EXIT_DATAERR" 'mutable image accepted' dp_release_validate marketplace "$sha" "$timestamp" ghcr.io/zolexora/app:latest
dp_test_assert_status "$DP_EXIT_DATAERR" 'malformed digest accepted' dp_release_validate marketplace "$sha" "$timestamp" ghcr.io/zolexora/app@sha256:short
dp_test_assert_status "$DP_EXIT_DATAERR" 'duplicate image accepted' dp_release_validate marketplace "$sha" "$timestamp" "$sha_image,$sha_image"
dp_test_assert_status "$DP_EXIT_DATAERR" 'empty image member accepted' dp_release_validate marketplace "$sha" "$timestamp" "$sha_image,"
dp_test_assert_status "$DP_EXIT_DATAERR" 'invalid timestamp accepted' dp_release_validate marketplace "$sha" 2023-02-29T00:00:00Z "$sha_image"

printf 'APPLICATION_ID=marketplace\nRELEASE_ID=%s\nCREATED_AT_UTC=%s\n' "$sha" "$timestamp" >"$temp_dir/missing.conf"
printf 'APPLICATION_ID=marketplace\nRELEASE_ID=%s\nCREATED_AT_UTC=%s\nIMAGE_REFERENCES=%s\nEXTRA=value\n' "$sha" "$timestamp" "$sha_image" >"$temp_dir/unknown.conf"
printf 'APPLICATION_ID=marketplace\nAPPLICATION_ID=worker\nRELEASE_ID=%s\nCREATED_AT_UTC=%s\nIMAGE_REFERENCES=%s\n' "$sha" "$timestamp" "$sha_image" >"$temp_dir/duplicate.conf"
for file in missing unknown duplicate; do
  loaded=([KEEP]=unchanged)
  dp_test_assert_status "$DP_EXIT_CONFIG" 'invalid metadata file returned wrong status' dp_release_metadata_load "$temp_dir/$file.conf" loaded
  dp_test_assert_eq unchanged "${loaded[KEEP]-}" 'failed metadata load changed destination state'
done

marker="$temp_dir/not-created"
dp_test_assert_status "$DP_EXIT_DATAERR" 'shell-like release input accepted' dp_release_validate "marketplace;touch $marker" "$sha" "$timestamp" "$sha_image"
[[ ! -e $marker ]] || dp_test_fail 'shell-like release input executed'

dp_test_finish 'release unit tests'
