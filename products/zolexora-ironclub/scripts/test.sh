#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🏋️ Running Zolexora IronClub Test Suite..."

echo "[1/3] Backend Unit Tests (Pytest)..."
"$ROOT_DIR/apps/backend/.venv/bin/pytest" "$ROOT_DIR/apps/backend/tests/"

echo "[2/3] Shared Types Check..."
pnpm --filter @zolexora/ironclub-types typecheck

echo "[3/3] Frontend Typechecks..."
pnpm --filter @zolexora/ironclub-admin-web build
pnpm --filter @zolexora/ironclub-manager-web build
pnpm --filter @zolexora/ironclub-marketing-web build

echo "✅ All Zolexora IronClub tests & typechecks passed!"
