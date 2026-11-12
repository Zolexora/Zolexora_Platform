#!/usr/bin/env bash
# Run the Engage web dev server. Secrets come only from Infisical (../.infisical.json).
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
exec bash ../../../scripts/setup/with-infisical.sh . bash -c '
  for v in VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY; do [ -n "${!v:-}" ] || { echo "❌ $v missing in Infisical" >&2; exit 1; }; done
  exec pnpm --filter @zolexora/engage-web dev'
