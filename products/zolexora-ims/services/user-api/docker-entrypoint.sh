#!/bin/sh
# Starts the IMS API with its SQLite database continuously copied off the host by Litestream.
#  1. If the database file is missing (new server, host without a disk), restore it from the replica.
#  2. Run the API under Litestream: every change is pushed to the S3-compatible bucket within ~1s,
#     and the last changes are pushed on shutdown.
# Backups are required. IMS_REPLICATION=off runs without them (local development only) and says so.
set -eu

API="uvicorn main:app --host 0.0.0.0 --port ${PORT}"
CONFIG=/app/litestream.yml

if [ "${IMS_REPLICATION:-}" = "off" ]; then
  echo "WARNING: IMS_REPLICATION=off: the database at ${DATABASE_PATH} is NOT copied off this host." >&2
  exec ${API}
fi

missing=""
for v in IMS_BACKUP_S3_BUCKET IMS_BACKUP_S3_PATH IMS_BACKUP_S3_ACCESS_KEY_ID IMS_BACKUP_S3_SECRET_ACCESS_KEY; do
  eval "val=\${$v:-}"
  [ -n "${val}" ] || missing="${missing} ${v}"
done
if [ -n "${missing}" ]; then
  echo "Database backup not configured; missing:${missing} (Infisical /Zolexora_IMS)." >&2
  echo "Set them (any S3-compatible store), or IMS_REPLICATION=off for local development only." >&2
  exit 1
fi

mkdir -p "$(dirname "${DATABASE_PATH}")"
litestream restore -config "${CONFIG}" -if-db-not-exists -if-replica-exists "${DATABASE_PATH}"
exec litestream replicate -config "${CONFIG}" -exec "${API}"
