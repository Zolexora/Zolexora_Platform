#!/bin/bash
# Runs one product's Docker stack from prebuilt GHCR images.
#   bash scripts/docker/product-stack.sh <product-dir> {start|stop|restart|pull|status|logs} [services...]
# Images are built only by GitHub CI (reusable-docker-ghcr.yml) and never on this machine: compose
# files have no build: blocks. Every compose call goes through Infisical (the only secret source).
set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PRODUCT_DIR="$(cd "$1" && pwd)"
PRODUCT_DIR="${PRODUCT_DIR#"$REPO_ROOT"/}"
NAME="$(basename "$PRODUCT_DIR")"
shift
cd "$REPO_ROOT"

run_compose() {
  bash scripts/setup/with-infisical.sh "$PRODUCT_DIR" docker compose -f "$PRODUCT_DIR/compose.yaml" "$@"
}

pull_images() {
  if ! run_compose pull "$@"; then
    echo ""
    echo "❌ Could not pull the ${NAME} images from GHCR. Images are built only in GitHub CI:"
    echo "   - run the ${NAME} Docker images workflow in GitHub Actions (or push to main), and"
    echo "   - check you are logged in: echo <token> | docker login ghcr.io -u <github-user> --password-stdin"
    exit 1
  fi
}

start_stack() {
  echo "🚀 Starting ${NAME} (images from GHCR)"
  pull_images "$@"
  run_compose up -d "$@"
  run_compose ps
}

ACTION="${1:-}"
[ $# -gt 0 ] && shift
if [ -z "$ACTION" ]; then
  if [ -t 0 ]; then
    echo " ${NAME} - Docker"
    echo "1) Start (default)  2) Stop  3) Restart  4) Pull latest images  5) Status  6) Logs  0) Cancel"
    read -r -p "Select an option [1]: " OPTION
    case "${OPTION:-1}" in
      1) ACTION=start ;; 2) ACTION=stop ;; 3) ACTION=restart ;; 4) ACTION=pull ;;
      5) ACTION=status ;; 6) ACTION=logs ;; 0) exit 0 ;; *) echo "Invalid option."; exit 1 ;;
    esac
  else
    ACTION=start
  fi
fi

case "$ACTION" in
  start|up) start_stack "$@" ;;
  stop|down) run_compose down "$@" ;;
  restart) run_compose down; start_stack "$@" ;;
  pull) pull_images "$@" ;;
  status|ps) run_compose ps "$@" ;;
  logs) run_compose logs -f "$@" ;;
  build)
    echo "Images are built only in GitHub CI and pulled from GHCR. Use: pull, then start."
    exit 1
    ;;
  *) echo "Usage: docker-start.sh {start|stop|restart|pull|status|logs} [services...]"; exit 1 ;;
esac
