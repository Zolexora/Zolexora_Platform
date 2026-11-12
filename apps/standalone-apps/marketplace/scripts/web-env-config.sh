#!/bin/sh
# Writes window.__ENV__ (served as /env-config.js) for the Mahila Madel CRA app from the environment,
# which comes from Infisical (compose or scripts/setup/with-infisical.sh). Only public, browser-safe
# keys are written; values are JSON-escaped. Runs as an nginx /docker-entrypoint.d hook in the
# container (default output) and before `pnpm dev:mahila-madel` locally.
set -eu
out=${1:-/usr/share/nginx/html/env-config.js}
{
  echo "window.__ENV__ = {"
  for var in MARKETPLACE_API_URL AUTH_SERVICE_PUBLIC_URL TURNSTILE_SITE_KEY \
    FIREBASE_WEB_API_KEY FIREBASE_WEB_AUTH_DOMAIN FIREBASE_WEB_PROJECT_ID FIREBASE_WEB_APP_ID; do
    eval "val=\${$var-}"
    esc=$(printf '%s' "$val" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/</\\u003c/g')
    printf '  "%s": "%s",\n' "$var" "$esc"
  done
  echo "};"
} > "$out"
