#!/usr/bin/env bash
# Roll a Compose service back to an earlier image tag (every GHCR image is also tagged with its commit SHA).
# Usage: rollback.sh --dir apps/<category>/<p> --service <svc> --image-var <VAR> --image ghcr.io/zolexora/<img>:<old-sha> [--environment ...]
set -euo pipefail
echo "ROLLBACK: $*"
exec bash "$(dirname "${BASH_SOURCE[0]}")/deploy.sh" "$@"
