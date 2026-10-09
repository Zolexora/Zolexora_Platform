#!/usr/bin/env bash
set -euo pipefail

# Usage: rollback.sh --service SERVICE_NAME --version TAG
# Rolls back a service to a specific docker image tag.

SERVICE=""
VERSION=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --service)
      SERVICE="$2"
      shift 2
      ;;
    --version)
      VERSION="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${SERVICE}" || -z "${VERSION}" ]]; then
  echo "Error: --service and --version are required." >&2
  exit 1
fi

COMPOSE_FILE="${COMPOSE_FILE:-compose.yaml}"

echo "=================================================="
echo "ROLLBACK INITIATED"
echo "Service: ${SERVICE}"
echo "Target Version: ${VERSION}"
echo "=================================================="
echo "Note: This is a generic docker-compose rollback script."
echo "Production rollbacks on Azure Container Apps or OCI should be handled"
echo "by their respective deployment mechanisms."
echo "=================================================="

# Update the image tag in the environment so docker-compose picks it up
export IMAGE_TAG="${VERSION}"

echo "Step 1: Pulling image tag ${VERSION}..."
docker compose -f "${COMPOSE_FILE}" pull "${SERVICE}"

echo "Step 2: Recreating service..."
docker compose -f "${COMPOSE_FILE}" up -d "${SERVICE}"

echo "Rollback of ${SERVICE} to ${VERSION} completed successfully."
