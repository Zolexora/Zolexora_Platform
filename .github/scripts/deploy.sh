#!/usr/bin/env bash
set -euo pipefail

# Usage: deploy.sh --service SERVICE_NAME --environment dev|staging|prod --image DOCKER_IMAGE_URI
# Generic deployment script.

SERVICE=""
ENV=""
IMAGE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --service)
      SERVICE="$2"
      shift 2
      ;;
    --environment)
      ENV="$2"
      shift 2
      ;;
    --image)
      IMAGE="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${SERVICE}" || -z "${ENV}" || -z "${IMAGE}" ]]; then
  echo "Error: --service, --environment, and --image are required." >&2
  exit 1
fi

COMPOSE_FILE="${COMPOSE_FILE:-compose.yaml}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NOTIFY_SCRIPT="${SCRIPT_DIR}/notify.py"

echo "Deploying ${SERVICE} to ${ENV} using image ${IMAGE}..."

if [[ "${ENV}" == "prod" ]]; then
  echo "Production deployment is handled by external CI/CD (Azure Container Apps / OCI)."
  echo "Skipping generic docker-compose deploy."
  exit 0
fi

export IMAGE_TAG="${IMAGE}"

echo "Pulling latest image..."
if docker compose -f "${COMPOSE_FILE}" pull "${SERVICE}"; then
    echo "Starting service..."
    if docker compose -f "${COMPOSE_FILE}" up -d "${SERVICE}"; then
        echo "Deployment successful."
        if [[ -f "${NOTIFY_SCRIPT}" ]]; then
            python3 "${NOTIFY_SCRIPT}" --status success --product "${SERVICE}" --environment "${ENV}" --version "${IMAGE}"
        fi
        exit 0
    fi
fi

echo "Deployment failed."
if [[ -f "${NOTIFY_SCRIPT}" ]]; then
    python3 "${NOTIFY_SCRIPT}" --status failure --product "${SERVICE}" --environment "${ENV}" --version "${IMAGE}"
fi
exit 1
