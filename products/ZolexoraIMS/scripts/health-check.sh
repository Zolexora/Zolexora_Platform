#!/usr/bin/env bash
# ==============================================================================
# Zolexora IMS — Service Health & Smoke Test Monitor
# Probes backends, frontends, APIs, and databases with latency benchmarking
# Usage: ./scripts/health-check.sh [OPTIONS]
# ==============================================================================

set -eo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

WATCH_MODE=false
INTERVAL=5
JSON_OUTPUT=false
TIMEOUT=3

print_help() {
  echo -e "${BOLD}Usage:${NC} ./scripts/health-check.sh [OPTIONS]"
  echo ""
  echo -e "${BOLD}Options:${NC}"
  echo "  -w, --watch           Run continuous monitor loop"
  echo "  -i, --interval <sec>  Watch interval in seconds (default: 5)"
  echo "  -j, --json            Output machine-readable JSON format"
  echo "  -t, --timeout <sec>   HTTP probe timeout in seconds (default: 3)"
  echo "  -h, --help            Show this help message"
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -w|--watch)
      WATCH_MODE=true
      shift
      ;;
    -i|--interval)
      INTERVAL="$2"
      shift 2
      ;;
    -j|--json)
      JSON_OUTPUT=true
      shift
      ;;
    -t|--timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    -h|--help)
      print_help
      ;;
    *)
      echo -e "${RED}Unknown argument: $1${NC}"
      print_help
      ;;
  esac
done

probe_endpoint() {
  local url="$1"
  local start_time
  local end_time
  local http_code
  local response_body
  local latency_ms

  start_time=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')
  
  # Probe with curl
  response_body=$(curl -s -m "${TIMEOUT}" -w "\n%{http_code}" "${url}" 2>/dev/null || echo -e "\n000")
  http_code=$(echo "${response_body}" | tail -n1)
  
  end_time=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')
  latency_ms=$((end_time - start_time))

  echo "${http_code}|${latency_ms}"
}

run_check() {
  local overall_status="HEALTHY"
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # Define targets: NAME | URL | EXPECTED_CODE
  local targets=(
    "User Core API (FastAPI)|http://127.0.0.1:8000/health|200"
    "Admin API (FastAPI)|http://127.0.0.1:8001/health|200"
    "Aggregator API (Swiggy/Zomato)|http://127.0.0.1:8000/api/v1/aggregator/platforms|200"
    "User POS & Inventory Web|http://127.0.0.1:3000|200"
    "Admin Control Center Web|http://127.0.0.1:3001|200"
  )

  if [[ "${JSON_OUTPUT}" == "true" ]]; then
    local json_results="[]"
    for target in "${targets[@]}"; do
      IFS="|" read -r name url expected <<< "${target}"
      probe_res=$(probe_endpoint "${url}")
      code=$(echo "${probe_res}" | cut -d'|' -f1)
      latency=$(echo "${probe_res}" | cut -d'|' -f2)

      status="DOWN"
      if [[ "${code}" == "${expected}" || ( "${code}" -ge 200 && "${code}" -lt 400 ) ]]; then
        status="UP"
      else
        overall_status="UNHEALTHY"
      fi

      json_entry="{\"name\":\"${name}\",\"url\":\"${url}\",\"status\":\"${status}\",\"http_code\":${code},\"latency_ms\":${latency}}"
      json_results=$(python3 -c "import json; arr = json.loads('${json_results}'); arr.append(${json_entry}); print(json.dumps(arr))")
    done

    echo "{\"timestamp\":\"${timestamp}\",\"status\":\"${overall_status}\",\"services\":${json_results}}"
    if [[ "${overall_status}" != "HEALTHY" ]]; then
      return 1
    fi
    return 0
  fi

  # Terminal Table Output
  echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}${BOLD}║                     ZOLEXORA IMS — LIVE SYSTEM HEALTH MONITOR                        ║${NC}"
  echo -e "${CYAN}${BOLD}║                     Checked at: ${timestamp} UTC                               ║${NC}"
  echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════════════════════════════════════════╝${NC}"
  printf "${BOLD}%-32s %-36s %-8s %-10s %-10s${NC}\n" "SERVICE" "PROBE TARGET" "CODE" "LATENCY" "STATUS"
  echo "──────────────────────────────────────────────────────────────────────────────────────"

  for target in "${targets[@]}"; do
    IFS="|" read -r name url expected <<< "${target}"
    probe_res=$(probe_endpoint "${url}")
    code=$(echo "${probe_res}" | cut -d'|' -f1)
    latency=$(echo "${probe_res}" | cut -d'|' -f2)

    status_badge="${GREEN}● HEALTHY${NC}"
    if [[ "${code}" == "000" ]]; then
      status_badge="${RED}✕ OFFLINE${NC}"
      overall_status="DEGRADED"
    elif [[ "${code}" != "${expected}" && ( "${code}" -lt 200 || "${code}" -ge 400 ) ]]; then
      status_badge="${YELLOW}▲ ERR ${code}${NC}"
      overall_status="DEGRADED"
    elif [[ "${latency}" -gt 1500 ]]; then
      status_badge="${YELLOW}▲ SLOW${NC}"
    fi

    printf "%-32s %-36s %-8s %-10s %b\n" "${name}" "${url}" "${code}" "${latency}ms" "${status_badge}"
  done

  echo "──────────────────────────────────────────────────────────────────────────────────────"
  if [[ "${overall_status}" == "HEALTHY" ]]; then
    echo -e "${GREEN}${BOLD}✓ ALL SYSTEMS OPERATIONAL — All microservices and frontend SPAs are active.${NC}\n"
    return 0
  else
    echo -e "${YELLOW}${BOLD}⚠️ DEGRADED HEALTH — One or more targets failed or are offline.${NC}\n"
    return 1
  fi
}

if [[ "${WATCH_MODE}" == "true" ]]; then
  echo -e "${CYAN}Starting continuous watch monitor (Interval: ${INTERVAL}s). Press [CTRL+C] to stop.${NC}"
  while true; do
    clear
    run_check || true
    sleep "${INTERVAL}"
  done
else
  run_check
fi
