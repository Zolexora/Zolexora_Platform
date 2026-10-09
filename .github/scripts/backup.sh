#!/usr/bin/env bash
set -euo pipefail

# Usage: backup.sh --service SERVICE_NAME
# Creates a timestamped backup and uploads it to BACKUP_BUCKET.

SERVICE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --service)
      SERVICE="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${SERVICE}" ]]; then
  echo "Error: --service is required." >&2
  exit 1
fi

BUCKET="${BACKUP_BUCKET:-}"
if [[ -z "${BUCKET}" ]]; then
  echo "Warning: BACKUP_BUCKET not set. Will only create local backup." >&2
fi

PREFIX="${BACKUP_PREFIX:-backups/}"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
FILENAME="${SERVICE}-${TIMESTAMP}.bak.gz"
LOCAL_PATH="/tmp/${FILENAME}"
REMOTE_PATH="${PREFIX}${FILENAME}"

echo "Starting backup for ${SERVICE}..."

if [[ "${SERVICE}" == "frappe" ]]; then
  echo "Running frappe backup..."
  # Assumes we are in frappe-bench directory or bench is available globally for the site
  bench --site all backup
  echo "Note: Frappe handles its own backup files in sites/*/private/backups."
  echo "To upload to S3, configure Frappe S3 backups natively or sync the directory."
  exit 0
fi

# Generic DB backup (requires DATABASE_URL)
DB_URL="${DATABASE_URL:-}"
if [[ -z "${DB_URL}" ]]; then
  echo "Error: DATABASE_URL not set. Cannot perform database backup." >&2
  exit 1
fi

echo "Dumping database..."
pg_dump "${DB_URL}" | gzip > "${LOCAL_PATH}"

if [[ -n "${BUCKET}" ]]; then
  echo "Uploading to bucket: ${BUCKET}..."
  if command -v aws &> /dev/null; then
    aws s3 cp "${LOCAL_PATH}" "s3://${BUCKET}/${REMOTE_PATH}"
  elif command -v oci &> /dev/null; then
    # Note: Requires OCI namespace configuration, generic placeholder:
    oci os object put -bn "${BUCKET}" --name "${REMOTE_PATH}" --file "${LOCAL_PATH}"
  else
    echo "Error: Neither 'aws' nor 'oci' CLI found to upload the backup." >&2
    exit 1
  fi
  echo "Backup successfully uploaded to ${REMOTE_PATH}"
else
  echo "Backup stored locally at ${LOCAL_PATH}"
fi

echo "Backup complete."
