#!/bin/bash
# {start|stop|restart|pull|status|logs} [services...] — runs this stack from GHCR images built in CI.
exec bash "$(dirname "$0")/../../../scripts/docker/product-stack.sh" "$(dirname "$0")/.." "$@"
