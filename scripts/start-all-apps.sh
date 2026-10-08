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

start_app "products/ZolexoraTMS"
start_app "products/ZolexoraEngage"
start_app "products/ZolexoraIMS"
start_app "products/TheTextileCare"
start_app "products/RentoEasy"
start_app "products/ClarityFi"
start_app "products/ZolexoraAI/frontend"
start_app "products/ZolexoraMarketplace"
start_app "products/MaunKavach"

echo "All startup commands dispatched!"
