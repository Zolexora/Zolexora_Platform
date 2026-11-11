#!/bin/bash
set -e

echo "Starting all apps in the background..."

start_app() {
  local dir=$1
  if [ -d "$dir" ]; then
    echo "Starting in $dir"
    cd "$dir"
    # check package manager
    if [ -f "pnpm-lock.yaml" ] || grep -q "pnpm" package.json; then
      pnpm install --no-frozen-lockfile >/dev/null 2>&1 || true
      if grep -q '"dev":' package.json; then
        nohup pnpm run dev > .dev.log 2>&1 &
      fi
    elif [ -f "yarn.lock" ]; then
      yarn install >/dev/null 2>&1 || true
      if grep -q '"dev":' package.json; then
        nohup yarn run dev > .dev.log 2>&1 &
      fi
    else
      npm install >/dev/null 2>&1 || true
      if grep -q '"dev":' package.json; then
        nohup npm run dev > .dev.log 2>&1 &
      fi
    fi
    cd - >/dev/null
  fi
}

start_app "apps/core-platform/zolexora-tms"
start_app "apps/core-platform/zolexora-engage"
start_app "apps/core-platform/zolexora-ims"
start_app "apps/standalone-apps/textile-care"
start_app "apps/standalone-apps/rentoeasy"
start_app "apps/standalone-apps/clarityfi"
start_app "apps/core-platform/zolexora-ai/apps/web"
start_app "apps/core-platform/zolexora-shop"
start_app "apps/standalone-apps/maunkavach"
start_app "apps/standalone-apps/ironclub"
start_app "apps/zolexora-platform-admin/frontend"

echo "All startup commands dispatched!"
