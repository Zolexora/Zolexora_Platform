#!/usr/bin/env bash
# Start the Engage Docker stack. Secrets come only from Infisical (../.infisical.json).
# Usage: scripts/start-project.sh [up args...] | down | stop | logs | ps
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
WRAP=../../../scripts/setup/with-infisical.sh
REQUIRED="PORT BASE_PATH DATABASE_URL SUPABASE_URL SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY SUPABASE_JWKS_URL VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY WHATSAPP_PHONE_NUMBER_ID WHATSAPP_ACCESS_TOKEN WHATSAPP_APP_SECRET WHATSAPP_WEBHOOK_VERIFY_TOKEN"

case "${1:-}" in
  down|stop|logs|ps) exec bash "$WRAP" . docker compose "$@" ;;
esac

exec bash "$WRAP" . bash -c '
  for v in '"$REQUIRED"'; do [ -n "${!v:-}" ] || { echo "❌ $v missing in Infisical (/Zolexora_Engage)" >&2; exit 1; }; done
  docker compose pull && docker compose up -d "$@"' _ "$@"
