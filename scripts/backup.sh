#!/bin/bash
set -e

if [ ! -f .env ]; then
  echo "Please copy .env.example to .env and update values."
  exit 1
fi

set -a
source .env
set +a

# Default site if not set
SITE="${SITE_NAME:-site1.example.com}"

BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -z "$BACKUP_RETENTION_DAYS" ]; then
  BACKUP_RETENTION_DAYS=30
fi

echo "Creating site backup inside container..."
docker compose exec -T backend bench --site "$SITE" backup --with-files

echo "Copying backup archives to host backups folder..."
# Backups are created in /home/frappe/frappe-bench/sites/<site>/private/backups/
# Since ./backups is mounted to /home/frappe/frappe-bench/backups in the container,
# we can copy them inside the container to /home/frappe/frappe-bench/backups/<timestamp>/
docker compose exec -T backend mkdir -p "backups/$(basename "$BACKUP_DIR")"
docker compose exec -T backend sh -c "cp -f sites/$SITE/private/backups/* backups/$(basename "$BACKUP_DIR")/"

echo "Pruning backups older than $BACKUP_RETENTION_DAYS days..."
find backups -maxdepth 1 -type d -mtime +$BACKUP_RETENTION_DAYS -exec rm -rf {} +

echo "Backup completed successfully on host: $BACKUP_DIR"
