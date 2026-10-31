#!/usr/bin/env bash
# Run a command with secrets injected by Infisical. Infisical is the ONLY secret
# source: no .env files, no fallback. Fails fast (never hangs) if unavailable.
#
# Usage: scripts/setup/with-infisical.sh <dir-with-.infisical.json> <command> [args...]
# Env:   INFISICAL_ENV overrides the env slug; INFISICAL_TOKEN for CI/machine identities.
set -euo pipefail

DIR="${1:?usage: with-infisical.sh <dir> <command> [args...]}"; shift
[ $# -gt 0 ] || { echo "with-infisical.sh: no command given" >&2; exit 2; }
CONFIG="$DIR/.infisical.json"

[ -f "$CONFIG" ] || { echo "❌ $CONFIG not found — every product must declare its Infisical folder." >&2; exit 1; }
command -v infisical >/dev/null 2>&1 || { echo "❌ Infisical CLI not installed (pnpm ecosystem:setup)." >&2; exit 1; }
if [ -z "${INFISICAL_TOKEN:-}" ] && ! timeout 15 infisical user get token >/dev/null 2>&1; then
  echo "❌ Not authenticated with Infisical. Run 'infisical login' (or export INFISICAL_TOKEN) and retry." >&2
  exit 1
fi

read -r PROJECT_ID SECRET_PATH ENV_SLUG < <(python3 - "$CONFIG" <<'EOF'
import json, sys
c = json.load(open(sys.argv[1]))
print(c.get("workspaceId") or "-", c.get("secretsPath") or "/", c.get("defaultEnvironment") or "dev")
EOF
)
[ "$PROJECT_ID" != "-" ] || { echo "❌ $CONFIG has no workspaceId." >&2; exit 1; }
ENV_SLUG="${INFISICAL_ENV:-$ENV_SLUG}"

echo "🔐 Infisical: project ${PROJECT_ID:0:8}… path $SECRET_PATH env $ENV_SLUG" >&2
exec infisical run --silent --projectId="$PROJECT_ID" --env="$ENV_SLUG" --path="$SECRET_PATH" --recursive -- "$@"
