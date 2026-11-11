#!/usr/bin/env bash
# Deploy (or roll back) one Compose service to a given image on the current host.
# Usage: deploy.sh --dir apps/<category>/<p> --service <svc> --image-var <VAR> --image ghcr.io/zolexora/<img>:<tag> [--environment dev|staging|prod]
#   --image-var is the variable the service's compose `image:` reads, e.g. TMS_BACKEND_IMAGE.
# Secrets come from Infisical via scripts/setup/with-infisical.sh (no fallback).
set -euo pipefail

DIR="" SERVICE="" VAR="" IMAGE="" ENVIRONMENT="${INFISICAL_ENV:-dev}"
while [[ $# -gt 0 ]]; do
  case $1 in
    --dir) DIR="$2"; shift 2 ;;
    --service) SERVICE="$2"; shift 2 ;;
    --image-var) VAR="$2"; shift 2 ;;
    --image) IMAGE="$2"; shift 2 ;;
    --environment) ENVIRONMENT="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done
[[ -n "$DIR" && -n "$SERVICE" && -n "$VAR" && -n "$IMAGE" ]] || {
  echo "Error: --dir, --service, --image-var and --image are required." >&2; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NOTIFY="${ROOT}/.github/scripts/notify.py"
export "$VAR=$IMAGE" INFISICAL_ENV="$ENVIRONMENT"
dc() { bash "$ROOT/scripts/setup/with-infisical.sh" "$ROOT/$DIR" docker compose -f "$ROOT/$DIR/compose.yaml" "$@"; }

echo "Deploying $SERVICE ($DIR) to $ENVIRONMENT with $IMAGE"
if dc pull "$SERVICE" && dc up -d --no-deps "$SERVICE"; then
  status=success
else
  status=failure
fi
python3 "$NOTIFY" --status "$status" --product "$SERVICE" --environment "$ENVIRONMENT" --version "$IMAGE" || true
[[ "$status" == success ]]
