#!/bin/bash
set -e

if [ ! -f .env ]; then
  echo "Please copy .env.example to .env and update values."
  exit 1
fi

set -a
source .env
set +a

./scripts/backup.sh
