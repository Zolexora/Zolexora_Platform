#!/bin/sh
set -eu

cd /home/frappe/frappe-bench

redis_url() {
  case "$1" in
    redis://*) printf '%s\n' "$1" ;;
    *) printf 'redis://%s\n' "$1" ;;
  esac
}

bench set-config -g db_host "${DB_HOST:-mariadb}"
bench set-config -g redis_cache "$(redis_url "${REDIS_CACHE:-redis-cache:6379}")"
bench set-config -g redis_queue "$(redis_url "${REDIS_QUEUE:-redis-queue:6379}")"
bench set-config -g redis_socketio "$(redis_url "${REDIS_SOCKETIO:-redis-socketio:6379}")"
bench set-config -g socketio_port "${SOCKETIO_PORT:-9000}"
