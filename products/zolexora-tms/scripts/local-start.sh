#!/bin/bash

# Always execute from the repository root
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$REPO_ROOT"

echo "======================================"
echo " Zolexora TMS - Local Development"
echo "======================================"

# Re-run this script once under Infisical so every service inherits the secrets
if [ -z "$TMS_SECRETS_LOADED" ]; then
    export TMS_SECRETS_LOADED=1
    exec bash products/zolexora-tms/scripts/with-secrets.sh bash products/zolexora-tms/scripts/local-start.sh "$@"
fi

# Local dev defaults (non-secret); override via Infisical or the shell
export NODE_ENV="${NODE_ENV:-development}"
TMS_BACKEND_PORT="${TMS_BACKEND_PORT:-4030}"
# Vite dev servers proxy /api to the backend started by this script
export TMS_DEV_API_PROXY_TARGET="${TMS_DEV_API_PROXY_TARGET:-http://127.0.0.1:$TMS_BACKEND_PORT}"

echo "Which services would you like to start locally?"
echo "1) All Services (Default)"
echo "2) Backend API"
echo "3) TMS Frontend"
echo "4) Admin Dashboard"
echo "5) Custom (type specific names)"
echo "0) Cancel"
echo "======================================"
read -p "Select an option [1]: " OPTION

# Default to option 1 if empty
OPTION=${OPTION:-1}

SERVICES=""
case $OPTION in
    1) SERVICES="backend tms admin" ;;
    2) SERVICES="backend" ;;
    3) SERVICES="tms" ;;
    4) SERVICES="admin" ;;
    5) 
        read -p "Enter service names (e.g. backend tms): " SERVICES
        ;;
    0) 
        echo "Cancelled."
        exit 0 
        ;;
    *) 
        echo "Invalid option. Exiting."
        exit 1 
        ;;
esac

    ensure_backend_environment() {
        if ! command -v python3.12 >/dev/null 2>&1; then
            echo "Installing Python 3.12 and virtualenv support..."
            sudo apt-get update
            sudo apt-get install -y python3.12 python3.12-venv
        fi

        if [ ! -x products/zolexora-tms/apps/backend/.venv/bin/python ]; then
            echo "Creating backend Python 3.12 virtual environment..."
            python3.12 -m venv products/zolexora-tms/apps/backend/.venv
        fi

        if ! products/zolexora-tms/apps/backend/.venv/bin/python -c "import uvicorn" >/dev/null 2>&1; then
            echo "Installing backend Python dependencies..."
            products/zolexora-tms/apps/backend/.venv/bin/python -m pip install --upgrade pip
            products/zolexora-tms/apps/backend/.venv/bin/python -m pip install -e products/zolexora-tms/apps/backend
            products/zolexora-tms/apps/backend/.venv/bin/python -m pip install greenlet
        fi
    }

echo "Starting local services: $SERVICES"

# We will store PIDs so we can kill them all cleanly on Ctrl+C
PIDS=""

cleanup() {
    echo -e "\nStopping local services..."
    for PID in $PIDS; do
        kill $PID 2>/dev/null || true
    done
    echo "All local services stopped."
    exit 0
}

# Trap Ctrl+C (SIGINT) to run the cleanup function
trap cleanup SIGINT SIGTERM

if [[ "$SERVICES" == *"backend"* ]]; then
    ensure_backend_environment
    echo "Starting Backend API (port $TMS_BACKEND_PORT)..."
    PYTHONPATH=products/zolexora-tms/apps/backend products/zolexora-tms/apps/backend/.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port "$TMS_BACKEND_PORT" --app-dir products/zolexora-tms/apps/backend &
    PIDS="$PIDS $!"
fi

if [[ "$SERVICES" == *"tms"* ]]; then
    echo "Starting TMS Frontend..."
    pnpm --filter @zolexora/tms-web run dev &
    PIDS="$PIDS $!"
fi

if [[ "$SERVICES" == *"admin"* ]]; then
    echo "Starting Admin Dashboard..."
    pnpm --filter @zolexora/tms-admin run dev &
    PIDS="$PIDS $!"
fi

echo "======================================"
echo "Services are starting! (Press Ctrl+C to stop all)"

if [[ "$SERVICES" == *"tms"* ]]; then
    echo "- TMS Frontend: http://localhost:3031"
fi
if [[ "$SERVICES" == *"admin"* ]]; then
    echo "- Admin Dashboard: http://localhost:3032"
fi
if [[ "$SERVICES" == *"backend"* ]]; then
    echo "- Backend API: http://localhost:$TMS_BACKEND_PORT/docs"
fi
echo "======================================"

# Wait for all background processes to keep the script running
wait
