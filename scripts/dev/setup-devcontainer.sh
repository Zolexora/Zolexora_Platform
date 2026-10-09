#!/usr/bin/env bash
set -e

# Resolve repository root directory regardless of invocation path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "==> Configuring Zolexora Platform Dev Environment in ${WORKSPACE_DIR}..."

# 1. Initialize workspace virtualenv if not present
if [ ! -d "${WORKSPACE_DIR}/.venv" ]; then
    echo "==> Creating Python virtual environment in ${WORKSPACE_DIR}/.venv..."
    python3 -m venv "${WORKSPACE_DIR}/.venv"
fi

# 2. Upgrade pip and core packaging tools in the virtualenv
echo "==> Upgrading pip and core packaging tools in .venv..."
"${WORKSPACE_DIR}/.venv/bin/pip" install --upgrade pip setuptools wheel 2>/dev/null || true

# 3. Dynamic Frappe compatibility symlinks
echo "==> Configuring Frappe path compatibility symlinks..."
PYTHON_BIN="$(which python3)"
if [ -f "${WORKSPACE_DIR}/.venv/bin/pip" ]; then
    PIP_BIN="${WORKSPACE_DIR}/.venv/bin/pip"
elif which pip3 >/dev/null 2>&1; then
    PIP_BIN="$(which pip3)"
elif which pip >/dev/null 2>&1; then
    PIP_BIN="$(which pip)"
else
    PIP_BIN=""
fi

sudo mkdir -p /home/frappe/frappe-bench/env/bin
sudo ln -sf "${PYTHON_BIN}" /home/frappe/frappe-bench/env/bin/python
sudo ln -sf "${PYTHON_BIN}" /home/frappe/frappe-bench/env/bin/python3
if [ -n "${PIP_BIN}" ]; then
    sudo ln -sf "${PIP_BIN}" /home/frappe/frappe-bench/env/bin/pip
fi

# 4. Initialize .env from .env.example if missing
if [ ! -f "${WORKSPACE_DIR}/config/envs/zolexora-erp/erp.env" ] && [ -f "${WORKSPACE_DIR}/config/envs/zolexora-erp/erp.env.example" ]; then
    echo "==> Copying config/envs/zolexora-erp/erp.env.example to config/envs/zolexora-erp/erp.env..."
    cp -n "${WORKSPACE_DIR}/config/envs/zolexora-erp/erp.env.example" "${WORKSPACE_DIR}/config/envs/zolexora-erp/erp.env" 2>/dev/null || true
fi

# 5. Fix permissions for non-root user
CURRENT_USER="$(whoami)"
if [ -d "${WORKSPACE_DIR}/.venv" ] && [ "${CURRENT_USER}" != "root" ]; then
    sudo chown -R "${CURRENT_USER}:${CURRENT_USER}" "${WORKSPACE_DIR}/.venv" 2>/dev/null || true
fi

echo "==> Zolexora Platform Dev Environment initialized successfully!"
