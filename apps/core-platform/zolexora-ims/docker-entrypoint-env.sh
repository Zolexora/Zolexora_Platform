#!/bin/sh
# Writes window.__ENV__ (served as /env-config.js) from the container environment, which compose
# fills from Infisical. Only public, browser-safe keys are exposed; values are JSON-escaped.
set -eu
: "${IMS_API_URL:?IMS_API_URL (the IMS backend base URL, e.g. http://ims-user-backend:4050) is required}"
out=/usr/share/nginx/html/env-config.js
{
  echo "window.__ENV__ = {"
  for var in AUTH_SERVICE_PUBLIC_URL TURNSTILE_SITE_KEY \
    NEXT_PUBLIC_IMS_CLIENT_FIREBASE_API_KEY NEXT_PUBLIC_IMS_CLIENT_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_IMS_CLIENT_FIREBASE_APP_ID NEXT_PUBLIC_FIREBASE_PROJECT_ID $(env | grep -oE '^VITE_[A-Z0-9_]+' || true); do
    eval "val=\${$var-}"
    esc=$(printf '%s' "$val" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/</\\u003c/g')
    printf '  "%s": "%s",\n' "$var" "$esc"
  done
  echo "};"
} > "$out"
