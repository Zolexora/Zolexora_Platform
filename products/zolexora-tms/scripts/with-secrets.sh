#!/bin/bash
# Single entry point for Zolexora TMS secrets: runs "$@" with secrets injected by Infisical.
# Infisical is the only secret source (no .env / dotenvx / Bitwarden).
# Non-blocking: if Infisical is not authenticated, warns and runs with the current shell env.
#
# Usage: bash products/zolexora-tms/scripts/with-secrets.sh <command> [args...]
# Override: INFISICAL_ENV (default: dev)

INFISICAL_ENV="${INFISICAL_ENV:-dev}"

# App secrets (Firebase, storage, payments, ...)
INFISICAL_PROJECT_ID="188824cd-59ce-468f-b60f-f2da7aeefe63"
INFISICAL_PATH="/Firebase_Credentials/Zolexora_TMS"

# Database credentials (Render Postgres)
INFISICAL_DB_PROJECT_ID="c4ac7d07-f26f-4fb8-bd04-6d3e037079f9"
INFISICAL_DB_PATH="/Render_Postgraes"

if [ -n "$INFISICAL_TOKEN" ] || [ -n "$INFISICAL_ACCESS_TOKEN" ] || \
   { command -v infisical >/dev/null 2>&1 && infisical login status >/dev/null 2>&1; }; then
  echo "🔐 Injecting secrets from Infisical (env: $INFISICAL_ENV)..." >&2
  exec infisical run --projectId="$INFISICAL_DB_PROJECT_ID" --env="$INFISICAL_ENV" --path="$INFISICAL_DB_PATH" -- \
    infisical run --projectId="$INFISICAL_PROJECT_ID" --env="$INFISICAL_ENV" --path="$INFISICAL_PATH" -- \
    "$@"
fi

echo "⚠️  Infisical is not authenticated - secrets will NOT be injected." >&2
echo "ℹ️  Run 'infisical login' or export INFISICAL_TOKEN. Continuing with the current environment..." >&2
exec "$@"
