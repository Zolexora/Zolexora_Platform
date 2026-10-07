#!/usr/bin/env bash

set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

pnpm install --frozen-lockfile
pnpm --filter @workspace/db push
