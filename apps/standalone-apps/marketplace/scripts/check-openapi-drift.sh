#!/usr/bin/env bash
set -e
before=$(sha256sum contracts/marketplace/openapi.json packages/shared-api/src/generated/types.ts)
pnpm generate:openapi
pnpm generate:client
after=$(sha256sum contracts/marketplace/openapi.json packages/shared-api/src/generated/types.ts)
if [ "$before" != "$after" ]; then
  echo "Error: OpenAPI schema or generated types have drifted. Please run pnpm generate:client and commit the changes."
  exit 1
fi
echo "OpenAPI drift check passed."
