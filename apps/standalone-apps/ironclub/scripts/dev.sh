#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🏋️ ================================================================="
echo "    ZOLEXORA IRONCLUB — SMART GYM MANAGEMENT PLATFORM"
echo "================================================================="

echo "1. Checking Backend Virtual Environment..."
if [ ! -d "$ROOT_DIR/services/backend/.venv" ]; then
    echo "Creating Python virtual environment in services/backend/.venv..."
    python3 -m venv "$ROOT_DIR/services/backend/.venv"
    "$ROOT_DIR/services/backend/.venv/bin/pip" install -r "$ROOT_DIR/services/backend/requirements.txt"
fi

echo "2. Running Backend Verification Tests..."
"$ROOT_DIR/services/backend/.venv/bin/pytest" "$ROOT_DIR/services/backend/tests/"

echo "3. Starting Zolexora IronClub Services..."
echo "   - HQ Admin Web:     http://localhost:3040"
echo "   - Manager Web:      http://localhost:3042"
echo "   - Marketing Web:    http://localhost:3043"
echo "   - Backend API:      http://localhost:4060 (Docs: /docs)"
echo "   - Manager Mobile:   pnpm dev:ironclub:mobile:manager"
echo "   - Member Mobile:    pnpm dev:ironclub:mobile:member"

# Start backend in background or foreground
cd "$ROOT_DIR/services/backend"
"$ROOT_DIR/services/backend/.venv/bin/python" -m uvicorn app.main:app --host 0.0.0.0 --port 4060 --reload
