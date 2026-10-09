#!/usr/bin/env bash
set -euo pipefail

# Usage: docker-cleanup.sh [--aggressive]
# Cleans up unused docker containers and images to free up space.

AGGRESSIVE=0

while [[ $# -gt 0 ]]; do
  case $1 in
    --aggressive)
      AGGRESSIVE=1
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

echo "Disk space before cleanup:"
docker system df

echo "Removing stopped containers..."
docker container prune -f

echo "Removing dangling images..."
docker image prune -f

if [[ ${AGGRESSIVE} -eq 1 ]]; then
  echo "Aggressive mode: removing unused images older than 24h..."
  docker image prune -a --filter "until=24h" -f
fi

echo "Disk space after cleanup:"
docker system df

echo "Docker cleanup complete."
