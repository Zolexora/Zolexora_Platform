#!/usr/bin/env bash
# =============================================================================
# Zolexora Platform — Devcontainer Setup
# Installs and configures every tool required across all products:
#
#   Products covered:
#     ZolexoraERP        — Frappe/ERPNext (Python, bench, submodules)
#     ZolexoraMarketplace — Ecom marketplace app (FastAPI/Python, Next.js, Expo/EAS)
#     TheTextileCare      — Laundry app (FastAPI/Python, Next.js, Expo)
#     ZolexoraTMS         — Transport management (FastAPI/Python, Next.js, Supabase)
#     ZolexoraIMS         — Inventory management (Next.js, Cloudflare Workers/Wrangler)
#     ZolexoraAI          — AI product (FastAPI/Python, Celery)
#     ZolexoraEngage      — Engagement platform (pnpm/TS)
#     ClarityFi           — Fintech (pnpm/TS, Expo)
#     RentoEasy           — Rental platform (pnpm/TS)
#     MaunKavach          — Security (Android/Kotlin — Gradle wrapper in repo)
#
#   Tooling installed:
#     git-lfs             — Binary asset tracking (pre-push hook)
#     Python venv         — Workspace-level pip/setuptools/wheel
#     pnpm (latest)       — JS package manager (all products)
#     turbo               — Monorepo task runner
#     expo-cli + eas-cli  — Expo / React Native builds
#     wrangler            — Cloudflare Workers (ZolexoraIMS)
#     firebase-tools      — Firebase hosting / functions (root firebase.json)
#     supabase CLI        — Supabase (ZolexoraTMS, infrastructure/supabase)
#     agy (Antigravity)   — AI coding assistant CLI
#     codex               — OpenAI Codex CLI
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

log() { echo "==> $*"; }
ok()  { echo "    ✓ $*"; }
skip(){ echo "    · $* (already installed, skipping)"; }

log "Configuring Zolexora Platform Dev Environment"
log "Workspace: ${WORKSPACE_DIR}"
echo ""

# =============================================================================
# 1. git-lfs — required for pre-push hook (.gitattributes tracks binary assets)
# =============================================================================
log "[1/11] git-lfs"
if ! command -v git-lfs > /dev/null 2>&1; then
    curl -fsSL https://packagecloud.io/install/repositories/github/git-lfs/script.deb.sh | sudo bash > /dev/null 2>&1
    sudo apt-get install -y git-lfs > /dev/null 2>&1
    git lfs install --system > /dev/null 2>&1
    ok "git-lfs installed and initialized"
else
    git lfs install --system > /dev/null 2>&1 || true
    skip "git-lfs $(git-lfs version 2>/dev/null | head -1)"
fi

# =============================================================================
# 2. Python virtual environment (workspace root)
# =============================================================================
log "[2/11] Python venv (workspace root)"
if [ ! -d "${WORKSPACE_DIR}/scripts/.venv" ]; then
    python3 -m venv "${WORKSPACE_DIR}/scripts/.venv"
    ok "Created scripts/.venv"
else
    skip "scripts/.venv"
fi
"${WORKSPACE_DIR}/scripts/.venv/bin/pip" install --upgrade pip setuptools wheel packaging > /dev/null 2>&1
ok "pip/setuptools/wheel up to date"

# Frappe path compatibility symlinks (ZolexoraERP)
log "    Configuring Frappe path symlinks..."
PYTHON_BIN="$(which python3)"
PIP_BIN="${WORKSPACE_DIR}/scripts/.venv/bin/pip"
sudo mkdir -p /home/frappe/frappe-bench/env/bin
sudo ln -sf "${PYTHON_BIN}" /home/frappe/frappe-bench/env/bin/python
sudo ln -sf "${PYTHON_BIN}" /home/frappe/frappe-bench/env/bin/python3
sudo ln -sf "${PIP_BIN}"    /home/frappe/frappe-bench/env/bin/pip
ok "Frappe symlinks set"

# =============================================================================
# 3. pnpm — JS package manager for all products
# =============================================================================
log "[3/11] pnpm"
if ! command -v pnpm > /dev/null 2>&1; then
    npm install -g pnpm@latest --quiet
    ok "pnpm installed: $(pnpm --version)"
else
    # Ensure latest is available; products pin their own versions via packageManager
    npm install -g pnpm@latest --quiet 2>/dev/null || true
    skip "pnpm $(pnpm --version)"
fi

# =============================================================================
# 4. turbo — Monorepo build runner (ZolexoraMarketplace, TheTextileCare, etc.)
# =============================================================================
log "[4/11] turbo"
if ! command -v turbo > /dev/null 2>&1; then
    npm install -g turbo --quiet
    ok "turbo installed: $(turbo --version)"
else
    skip "turbo $(turbo --version)"
fi

# =============================================================================
# 5. Expo CLI + EAS CLI — React Native mobile apps
#    (ZolexoraMarketplace: 3 Expo apps with eas.json; ClarityFi, TheTextileCare)
# =============================================================================
log "[5/11] expo + eas (React Native mobile)"
if ! command -v expo > /dev/null 2>&1; then
    npm install -g expo-cli @expo/cli eas-cli --quiet
    ok "expo + eas installed"
else
    skip "expo $(expo --version 2>/dev/null || echo '?')"
fi
if ! command -v eas > /dev/null 2>&1; then
    npm install -g eas-cli --quiet
    ok "eas-cli installed"
else
    skip "eas $(eas --version 2>/dev/null || echo '?')"
fi

# =============================================================================
# 6. Wrangler — Cloudflare Workers (ZolexoraIMS: ims-admin, ims-user)
# =============================================================================
log "[6/11] wrangler (Cloudflare Workers)"
if ! command -v wrangler > /dev/null 2>&1; then
    npm install -g wrangler --quiet
    ok "wrangler installed: $(wrangler --version 2>/dev/null)"
else
    skip "wrangler $(wrangler --version 2>/dev/null)"
fi

# =============================================================================
# 7. Firebase CLI — firebase.json at repo root, Firebase hosting/functions
# =============================================================================
log "[7/11] firebase-tools"
if ! command -v firebase > /dev/null 2>&1; then
    npm install -g firebase-tools --quiet
    ok "firebase-tools installed: $(firebase --version 2>/dev/null)"
else
    skip "firebase $(firebase --version 2>/dev/null)"
fi

# =============================================================================
# 8. Supabase CLI — ZolexoraTMS (supabase-js), infrastructure/supabase
# =============================================================================
log "[8/11] supabase CLI"
if ! command -v supabase > /dev/null 2>&1; then
    # Install via official binary (no apt package in bookworm yet)
    SUPABASE_VERSION="2.30.4"
    curl -fsSL "https://github.com/supabase/cli/releases/download/v${SUPABASE_VERSION}/supabase_linux_amd64.tar.gz" \
        | sudo tar -xz -C /usr/local/bin supabase
    ok "supabase CLI installed: $(supabase --version 2>/dev/null)"
else
    skip "supabase $(supabase --version 2>/dev/null)"
fi

# =============================================================================
# 9. Antigravity CLI (agy) — AI coding assistant
# =============================================================================
log "[9/11] agy (Antigravity CLI)"
if ! command -v agy > /dev/null 2>&1; then
    pip3 install --user antigravity-cli --quiet 2>/dev/null \
        || npm install -g @google/antigravity-cli --quiet 2>/dev/null \
        || echo "    ⚠ agy: auto-install failed — install manually per https://antigravity.dev/docs/cli"
    command -v agy > /dev/null 2>&1 && ok "agy installed: $(agy --version 2>/dev/null)" || true
else
    skip "agy $(agy --version 2>/dev/null)"
fi

# =============================================================================
# 10. OpenAI Codex CLI
# =============================================================================
log "[10/12] codex (OpenAI Codex CLI)"
if ! command -v codex > /dev/null 2>&1; then
    npm install -g @openai/codex --quiet 2>/dev/null \
        || echo "    ⚠ codex: auto-install failed — install manually: npm install -g @openai/codex"
    command -v codex > /dev/null 2>&1 && ok "codex installed: $(codex --version 2>/dev/null)" || true
else
    skip "codex $(codex --version 2>/dev/null)"
fi


# =============================================================================
# 11. Infisical CLI — Secrets manager for all products
# =============================================================================
log "[11/12] infisical (Secrets Manager)"
if ! command -v infisical > /dev/null 2>&1; then
    curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.deb.sh' \
        | sudo bash > /dev/null 2>&1
    sudo apt-get install -y infisical > /dev/null 2>&1
    ok "infisical installed: $(infisical --version 2>/dev/null)"
else
    skip "infisical $(infisical --version 2>/dev/null)"
fi

# =============================================================================
# 12. Environment files — copy .env.example → .env where missing
# =============================================================================
log "[12/12] Environment files"
ENV_SOURCES=(
    "config/envs/zolexora-erp/erp.env"
)
for env_file in "${ENV_SOURCES[@]}"; do
    example="${WORKSPACE_DIR}/${env_file}.example"
    target="${WORKSPACE_DIR}/${env_file}"
    if [ -f "${example}" ] && [ ! -f "${target}" ]; then
        cp "${example}" "${target}"
        ok "Created ${env_file} from example"
    fi
done

# Fix permissions for non-root user
CURRENT_USER="$(whoami)"
if [ "${CURRENT_USER}" != "root" ]; then
    sudo chown -R "${CURRENT_USER}:${CURRENT_USER}" \
        "${WORKSPACE_DIR}/scripts/.venv" 2>/dev/null || true
fi

echo ""
echo "============================================================"
echo " Zolexora Platform Dev Environment — Ready"
echo "============================================================"
echo " git-lfs  : $(git-lfs version 2>/dev/null | head -1 || echo 'n/a')"
echo " python3  : $(python3 --version 2>/dev/null)"
echo " pnpm     : $(pnpm --version 2>/dev/null || echo 'n/a')"
echo " turbo    : $(turbo --version 2>/dev/null || echo 'n/a')"
echo " expo     : $(expo --version 2>/dev/null || echo 'n/a')"
echo " eas      : $(eas --version 2>/dev/null || echo 'n/a')"
echo " wrangler : $(wrangler --version 2>/dev/null || echo 'n/a')"
echo " firebase : $(firebase --version 2>/dev/null || echo 'n/a')"
echo " supabase : $(supabase --version 2>/dev/null || echo 'n/a')"
echo " agy      : $(agy --version 2>/dev/null || echo 'n/a')"
echo " codex    : $(codex --version 2>/dev/null || echo 'n/a')"
echo "============================================================"
echo ""
echo " NOTE: MaunKavach (Android/Kotlin) requires Android Studio"
echo " locally. The Gradle wrapper (gradlew) in products/MaunKavach"
echo " handles builds — no extra install needed in this container."
echo "============================================================"
