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

start_app "products/zolexora-tms"
start_app "products/zolexora-engage"
start_app "products/zolexora-ims"
start_app "products/the-textile-care"
start_app "products/rentoeasy"
start_app "products/clarityfi"
start_app "products/zolexora-ai/frontend"
start_app "products/zolexora-marketplace"
start_app "products/maunkavach"
start_app "products/zolexora-ironclub"
start_app "apps/platform-admin/frontend"

echo "All startup commands dispatched!"
