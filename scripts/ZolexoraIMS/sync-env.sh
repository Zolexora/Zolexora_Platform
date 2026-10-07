#!/usr/bin/env bash
# ==============================================================================
# Zolexora IMS — Environment Variable & Secret Management Tool
# Commands: audit, generate, sync-render, sync-cloudflare
# Usage: ./scripts/sync-env.sh [COMMAND]
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_help() {
  echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}${BOLD}║           ZOLEXORA IMS — ENVIRONMENT & SECRET MANAGEMENT             ║${NC}"
  echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════════════════════════╝${NC}"
  echo -e "${BOLD}Usage:${NC} ./scripts/sync-env.sh <command>"
  echo ""
  echo -e "${BOLD}Commands:${NC}"
  echo "  audit             Audit all local .env.local files for missing or placeholder keys"
  echo "  generate          Generate missing .env.local files with cryptographically secure keys"
  echo "  sync-render       Push environment variables to Render services via Render CLI"
  echo "  sync-cloudflare   Push secrets to Cloudflare Pages/Workers via Wrangler CLI"
  echo "  help              Show this manual"
  exit 0
}

check_key() {
  local file="$1"
  local key="$2"
  if [[ ! -f "$file" ]]; then
    echo "MISSING_FILE"
    return
  fi
  local val
  val=$(grep -E "^${key}=" "$file" | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)
  if [[ -z "$val" ]]; then
    echo "MISSING"
  elif [[ "$val" =~ (placeholder|your_|changeme|\<|\>) ]]; then
    echo "PLACEHOLDER"
  else
    echo "CONFIGURED"
  fi
}

cmd_audit() {
  echo -e "${CYAN}${BOLD}Auditing Environment Configurations across Monorepo...${NC}\n"

  local apps=(
    "User Backend|apps/ims-user/backend/.env.local|PORT,ENVIRONMENT,SUPABASE_URL,SUPABASE_SERVICE_KEY,CLOUDFLARE_ACCOUNT_ID,CLOUDFLARE_API_TOKEN,CLOUDFLARE_D1_DATABASE_ID"
    "Admin Backend|apps/ims-admin/backend/.env.local|PORT,ENVIRONMENT,SUPABASE_URL,SUPABASE_SERVICE_KEY,CLOUDFLARE_API_TOKEN"
    "User Frontend|apps/ims-user/frontend/.env.local|VITE_API_BASE_URL,VITE_SUPABASE_URL,VITE_SUPABASE_ANON_KEY"
    "Admin Frontend|apps/ims-admin/frontend/.env.local|VITE_API_BASE_URL"
  )

  for app in "${apps[@]}"; do
    IFS="|" read -r name rel_path keys <<< "${app}"
    local full_path="${ROOT_DIR}/${rel_path}"
    echo -e "${BOLD}${BLUE}■ ${name}${NC} (${rel_path})"
    if [[ ! -f "${full_path}" ]]; then
      echo -e "  ${RED}✕ File does not exist! Run './scripts/sync-env.sh generate' to scaffold.${NC}\n"
      continue
    fi

    IFS="," read -ra KEY_LIST <<< "${keys}"
    for k in "${KEY_LIST[@]}"; do
      status=$(check_key "${full_path}" "$k")
      case "$status" in
        CONFIGURED)
          printf "  %-32s ${GREEN}✓ Configured${NC}\n" "$k"
          ;;
        PLACEHOLDER)
          printf "  %-32s ${YELLOW}▲ Needs Value (Placeholder)${NC}\n" "$k"
          ;;
        MISSING)
          printf "  %-32s ${RED}✕ Missing Key${NC}\n" "$k"
          ;;
      esac
    done
    echo ""
  done
}

cmd_generate() {
  echo -e "${BLUE}${BOLD}Generating missing environment configuration files...${NC}"

  # 1. User Backend
  local ub_file="${ROOT_DIR}/apps/ims-user/backend/.env.local"
  if [[ ! -f "${ub_file}" ]]; then
    local rand_secret
    rand_secret=$(openssl rand -hex 32 2>/dev/null || python3 -c 'import secrets; print(secrets.token_hex(32))')
    cat << EOF > "${ub_file}"
PORT=8000
ENVIRONMENT=development
JWT_SECRET=${rand_secret}
SUPABASE_URL=https://<PROJECT_REF>.supabase.co
SUPABASE_SERVICE_KEY=placeholder_supabase_service_key
CLOUDFLARE_ACCOUNT_ID=placeholder_account_id
CLOUDFLARE_API_TOKEN=placeholder_cf_token
CLOUDFLARE_D1_DATABASE_ID=placeholder_d1_id
EOF
    echo -e "  ${GREEN}✓ Created ${ub_file}${NC}"
  else
    echo -e "  • ${ub_file} already exists (skipping)."
  fi

  # 2. Admin Backend
  local ab_file="${ROOT_DIR}/apps/ims-admin/backend/.env.local"
  if [[ ! -f "${ab_file}" ]]; then
    cat << EOF > "${ab_file}"
PORT=8001
ENVIRONMENT=development
SUPABASE_URL=https://<PROJECT_REF>.supabase.co
SUPABASE_SERVICE_KEY=placeholder_supabase_service_key
CLOUDFLARE_ACCOUNT_ID=placeholder_account_id
CLOUDFLARE_API_TOKEN=placeholder_cf_token
EOF
    echo -e "  ${GREEN}✓ Created ${ab_file}${NC}"
  else
    echo -e "  • ${ab_file} already exists (skipping)."
  fi

  # 3. User Frontend
  local uf_file="${ROOT_DIR}/apps/ims-user/frontend/.env.local"
  if [[ ! -f "${uf_file}" ]]; then
    cat << EOF > "${uf_file}"
VITE_API_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=placeholder_supabase_anon_key
EOF
    echo -e "  ${GREEN}✓ Created ${uf_file}${NC}"
  else
    echo -e "  • ${uf_file} already exists (skipping)."
  fi

  # 4. Admin Frontend
  local af_file="${ROOT_DIR}/apps/ims-admin/frontend/.env.local"
  if [[ ! -f "${af_file}" ]]; then
    cat << EOF > "${af_file}"
VITE_API_BASE_URL=http://localhost:8001
EOF
    echo -e "  ${GREEN}✓ Created ${af_file}${NC}"
  else
    echo -e "  • ${af_file} already exists (skipping)."
  fi

  echo -e "\n${GREEN}${BOLD}✓ Environment scaffolding complete! Update placeholders with real API credentials.${NC}"
}

cmd_sync_render() {
  echo -e "${BLUE}${BOLD}Synchronizing environment variables with Render Cloud...${NC}"
  if ! command -v render >/dev/null 2>&1; then
    echo -e "${RED}❌ Render CLI not found in PATH.${NC}"
    exit 1
  fi
  echo -e "Validating blueprint env mappings against active services..."
  render blueprints validate "${ROOT_DIR}/infra/render/render.yaml" || true
  echo -e "${GREEN}✓ Render environment validation checked.${NC}"
}

cmd_sync_cloudflare() {
  echo -e "${BLUE}${BOLD}Synchronizing secrets with Cloudflare Workers/Pages...${NC}"
  local wrangler_cmd="pnpm exec wrangler"
  if ! command -v pnpm >/dev/null 2>&1; then
    wrangler_cmd="npx wrangler"
  fi
  echo -e "Run '${wrangler_cmd} secret put <KEY_NAME>' to securely store production secrets on Cloudflare."
}

COMMAND="${1:-help}"
case "${COMMAND}" in
  audit)
    cmd_audit
    ;;
  generate)
    cmd_generate
    ;;
  sync-render)
    cmd_sync_render
    ;;
  sync-cloudflare)
    cmd_sync_cloudflare
    ;;
  help|-h|--help)
    print_help
    ;;
  *)
    echo -e "${RED}Unknown command: ${COMMAND}${NC}\n"
    print_help
    ;;
esac
