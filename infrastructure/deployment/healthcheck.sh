#!/usr/bin/env bash
set -Eeuo pipefail

# Future health contract: 0 = healthy, 1 = warning, 2 = critical.
# DP-07 has no functional health implementation, so it must fail closed with 78.
printf '%s\n' 'ERROR: healthcheck.sh is not implemented as of DP-07; no operation was performed.' >&2
exit 78
