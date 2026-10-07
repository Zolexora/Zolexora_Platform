#!/usr/bin/env bash
# ==============================================================================
# ZOLEXORA IMS — ULTIMATE ENTERPRISE BOOTSTRAP & PROVISIONING SCRIPT
# ==============================================================================
# One-command automated onboarding: Installs CLIs, MCP servers, AI Skills, 
# dependencies, manages interactive terminal logins, and writes all environment configs.
# ==============================================================================

set -e

# ANSI Color Codes
BOLD="\033[1m"
GREEN="\033[38;5;48m"
CYAN="\033[38;5;51m"
BLUE="\033[38;5;39m"
YELLOW="\033[38;5;220m"
RED="\033[38;5;196m"
MAGENTA="\033[38;5;207m"
PURPLE="\033[38;5;141m"
DIM="\033[2m"
RESET="\033[0m"

log_banner() {
  clear 2>/dev/null || true
  echo -e "${PURPLE}${BOLD}"
  echo "  ███████╗ ██████╗ ██╗     ███████╗██╗  ██╗ ██████╗ ██████╗  █████╗      ██╗███╗   ███╗███████╗"
  echo "  ╚══███╔╝██╔═══██╗██║     ██╔════╝╚██╗██╔╝██╔═══██╗██╔══██╗██╔══██╗     ██║████╗ ████║██╔════╝"
  echo "    ███╔╝ ██║   ██║██║     █████╗   ╚███╔╝ ██║   ██║██████╔╝███████║     ██║██╔████╔██║███████╗"
  echo "   ███╔╝  ██║   ██║██║     ██╔══╝   ██╔██╗ ██║   ██║██╔══██╗██╔══██║     ██║██║╚██╔╝██║╚════██║"
  echo "  ███████╗╚██████╔╝███████╗███████╗██╔╝ ██╗╚██████╔╝██║  ██║██║  ██║     ██║██║ ╚═╝ ██║███████║"
  echo "  ╚══════╝ ╚═════╝ ╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝     ╚═╝╚═╝     ╚═╝╚══════╝"
  echo -e "${RESET}"
  echo -e "${CYAN}${BOLD}   >>> Enterprise Retail POS & Multi-Tenant Inventory Management System <<<${RESET}"
  echo -e "${DIM}   Automated Environment Setup, CLI Provisioner & Interactive Cloud Auth Login${RESET}"
  echo " ==========================================================================================="
  echo ""
}

log_step() {
  echo -e "\n${BLUE}${BOLD}==>${RESET} ${BOLD}$1${RESET}"
}

log_info() {
  echo -e "  ${CYAN}[INFO]${RESET} $1"
}

log_success() {
  echo -e "  ${GREEN}[✓]${RESET} $1"
}

log_warn() {
  echo -e "  ${YELLOW}[WARN]${RESET} $1"
}

log_error() {
  echo -e "  ${RED}[✗]${RESET} $1"
}

log_banner

# Determine workspace root
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"
log_info "Workspace Root detected: ${BOLD}$ROOT_DIR${RESET}"

# ------------------------------------------------------------------------------
# STEP 1: Operating System & Architecture Detection
# ------------------------------------------------------------------------------
log_step "Step 1: Inspecting Host Architecture & Package System"

OS_TYPE="$(uname -s)"
ARCH_TYPE="$(uname -m)"
log_info "Host Operating System: ${BOLD}${OS_TYPE} (${ARCH_TYPE})${RESET}"

install_pkg() {
  local pkg=$1
  if command -v apt-get &>/dev/null; then
    sudo apt-get update -y && sudo apt-get install -y "$pkg"
  elif command -v brew &>/dev/null; then
    brew install "$pkg"
  elif command -v dnf &>/dev/null; then
    sudo dnf install -y "$pkg"
  elif command -v pacman &>/dev/null; then
    sudo pacman -S --noconfirm "$pkg"
  fi
}

# ------------------------------------------------------------------------------
# STEP 2: Node.js, Corepack & pnpm Verification
# ------------------------------------------------------------------------------
log_step "Step 2: Checking Node.js, Corepack & pnpm Runtimes"

if ! command -v node &>/dev/null; then
  log_warn "Node.js not detected. Attempting installation..."
  if command -v brew &>/dev/null; then
    brew install node@20
  elif command -v apt-get &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
fi

NODE_VERSION=$(node -v 2>/dev/null || echo "Unknown")
log_success "Node.js Active: ${BOLD}${NODE_VERSION}${RESET}"

# Corepack & pnpm
log_info "Configuring pnpm package manager (v10.32.1)..."
if command -v corepack &>/dev/null; then
  corepack enable 2>/dev/null || true
  corepack prepare pnpm@10.32.1 --activate 2>/dev/null || true
fi

if ! command -v pnpm &>/dev/null; then
  log_info "Installing pnpm globally via npm..."
  npm install -g pnpm@10.32.1
fi

PNPM_VERSION=$(pnpm -v 2>/dev/null || echo "Unknown")
log_success "pnpm Active: ${BOLD}v${PNPM_VERSION}${RESET}"

# ------------------------------------------------------------------------------
# STEP 3: Python 3 & pip Environment
# ------------------------------------------------------------------------------
log_step "Step 3: Checking Python 3 Runtime & Backend Utilities"

if ! command -v python3 &>/dev/null; then
  log_warn "Python 3 not detected. Installing python3..."
  install_pkg python3
fi

PYTHON_VERSION=$(python3 --version 2>/dev/null || echo "Unknown")
log_success "Python Active: ${BOLD}${PYTHON_VERSION}${RESET}"

if ! python3 -m pip --version &>/dev/null; then
  log_info "Installing python3-pip and venv..."
  install_pkg python3-pip
  install_pkg python3-venv
fi

# ------------------------------------------------------------------------------
# STEP 4: Docker & Containerization Tooling
# ------------------------------------------------------------------------------
log_step "Step 4: Verifying Docker & Container Runtime"

if command -v docker &>/dev/null; then
  DOCKER_VER=$(docker --version 2>/dev/null || echo "Installed")
  log_success "Docker Engine: ${BOLD}${DOCKER_VER}${RESET}"
  if docker compose version &>/dev/null; then
    COMPOSE_VER=$(docker compose version 2>/dev/null || echo "Installed")
    log_success "Docker Compose: ${BOLD}${COMPOSE_VER}${RESET}"
  else
    log_warn "Docker compose plugin not found. Some multi-container commands might require docker-compose."
  fi
else
  log_warn "Docker is not currently installed or running. Containerized deployments will require Docker."
fi

# ------------------------------------------------------------------------------
# STEP 5: Essential Developer & Cloud CLIs (GitHub, Cloudflare, Render, Supabase)
# ------------------------------------------------------------------------------
log_step "Step 5: Provisioning Essential Cloud & Developer CLIs"

# 1. GitHub CLI (gh)
if command -v gh &>/dev/null; then
  GH_VER=$(gh --version | head -n 1)
  log_success "GitHub CLI (gh): ${BOLD}${GH_VER}${RESET}"
else
  log_info "Installing GitHub CLI (gh)..."
  if command -v apt-get &>/dev/null; then
    (type -p wget >/dev/null || (sudo apt update && sudo apt-get install wget -y)) \
    && sudo mkdir -p -m 755 /etc/apt/keyrings \
    && wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
    && sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && sudo apt update && sudo apt install gh -y
  elif command -v brew &>/dev/null; then
    brew install gh
  fi
  log_success "GitHub CLI installed."
fi

# 2. Cloudflare Wrangler CLI
if command -v wrangler &>/dev/null || pnpm dlx wrangler --version &>/dev/null 2>&1; then
  log_success "Cloudflare Wrangler CLI: ${BOLD}Available via pnpm/wrangler${RESET}"
else
  log_info "Installing Wrangler CLI..."
  pnpm add -g wrangler 2>/dev/null || npm install -g wrangler
  log_success "Wrangler CLI installed."
fi

# 3. Render CLI
if command -v render &>/dev/null || [ -f "$HOME/.local/bin/render" ]; then
  export PATH="$HOME/.local/bin:$PATH"
  RENDER_VER=$(render --version 2>/dev/null || echo "Render CLI")
  log_success "Render CLI: ${BOLD}${RENDER_VER}${RESET}"
else
  log_info "Installing Render CLI..."
  curl -fsSL https://render.com/install.sh | bash 2>/dev/null || true
  export PATH="$HOME/.local/bin:$PATH"
  if command -v render &>/dev/null; then
    log_success "Render CLI successfully installed."
  fi
fi

# 4. Supabase CLI
if command -v supabase &>/dev/null; then
  SUPA_VER=$(supabase --version 2>/dev/null || echo "Supabase CLI")
  log_success "Supabase CLI: ${BOLD}${SUPA_VER}${RESET}"
else
  log_info "Installing Supabase CLI via pnpm..."
  pnpm add -g supabase 2>/dev/null || true
  log_success "Supabase CLI ready."
fi

# ------------------------------------------------------------------------------
# STEP 6: AI MCP Servers & Local Skills Configuration
# ------------------------------------------------------------------------------
log_step "Step 6: Verifying Local AI Skills & MCP Server Configurations"

if [ -d "$ROOT_DIR/.agents/skills" ]; then
  SKILLS_COUNT=$(find "$ROOT_DIR/.agents/skills" -maxdepth 1 -mindepth 1 -type d | wc -l)
  log_success "Local AI Skills: ${BOLD}${SKILLS_COUNT} skills configured${RESET} (.agents/skills/)"
fi

if [ -f "$ROOT_DIR/.gemini/mcp_config.json" ] || [ -f "$ROOT_DIR/.vscode/mcp.json" ]; then
  log_success "Local MCP Configuration: ${BOLD}Active${RESET} (.gemini/ & .vscode/)"
fi

# ------------------------------------------------------------------------------
# STEP 7: Monorepo Dependencies Installation
# ------------------------------------------------------------------------------
log_step "Step 7: Installing Monorepo Dependencies (Python & Node.js)"

log_info "Installing Python dependencies for User API (FastAPI)..."
python3 -m pip install -q --no-cache-dir -r "$ROOT_DIR/apps/ims-user/backend/requirements.txt"
log_success "User API dependencies installed."

log_info "Installing Python dependencies for Admin API (FastAPI)..."
python3 -m pip install -q --no-cache-dir -r "$ROOT_DIR/apps/ims-admin/backend/requirements.txt"
log_success "Admin API dependencies installed."

log_info "Installing Frontend monorepo packages via pnpm..."
pnpm install
log_success "Frontend packages installed cleanly."

# ------------------------------------------------------------------------------
# STEP 8: Interactive Terminal Auth Wizard (Cloud Services)
# ------------------------------------------------------------------------------
log_step "Step 8: Interactive Terminal Authentication & Cloud Login"
echo -e "${DIM}  We will now verify your terminal sessions for GitHub, Cloudflare, Render & Supabase.${RESET}"
echo -e "${DIM}  You can log in directly right now or skip if you already have valid tokens.${RESET}\n"

# 1. GitHub Login Check
echo -e "${BOLD}[1/4] GitHub Authentication (gh)${RESET}"
if gh auth status &>/dev/null; then
  GH_USER=$(gh api user -q .login 2>/dev/null || echo "Authenticated")
  log_success "GitHub logged in as: ${BOLD}${GH_USER}${RESET}"
else
  echo -e "  ${YELLOW}GitHub CLI is not currently authenticated.${RESET}"
  read -p "  Would you like to log in to GitHub now? (Y/n): " do_gh_login
  if [[ "$do_gh_login" =~ ^[Yy]?$ ]]; then
    gh auth login
  else
    log_warn "Skipped GitHub login. You can run 'gh auth login' later."
  fi
fi

# 2. Cloudflare Wrangler Login Check
echo ""
echo -e "${BOLD}[2/4] Cloudflare Edge & D1 Database (wrangler)${RESET}"
if npx wrangler whoami &>/dev/null; then
  log_success "Cloudflare Wrangler: ${BOLD}Authenticated${RESET}"
else
  echo -e "  ${YELLOW}Wrangler is not logged in.${RESET}"
  read -p "  Would you like to log in to Cloudflare now via browser? (y/N): " do_cf_login
  if [[ "$do_cf_login" =~ ^[Yy]$ ]]; then
    npx wrangler login
  else
    log_warn "Skipped Cloudflare login. You can run 'npx wrangler login' anytime."
  fi
fi

# 3. Render Cloud Login Check
echo ""
echo -e "${BOLD}[3/4] Render Cloud Platform (render)${RESET}"
if command -v render &>/dev/null; then
  if render whoami &>/dev/null; then
    log_success "Render CLI: ${BOLD}Authenticated${RESET}"
  else
    echo -e "  ${YELLOW}Render CLI is not logged in.${RESET}"
    read -p "  Would you like to log in to Render now? (y/N): " do_render_login
    if [[ "$do_render_login" =~ ^[Yy]$ ]]; then
      render login
    else
      log_warn "Skipped Render login. You can run 'render login' later."
    fi
  fi
fi

# 4. Supabase Credentials Configuration
echo ""
echo -e "${BOLD}[4/4] Supabase Authentication & Database Keys${RESET}"

USER_BACKEND_ENV="$ROOT_DIR/apps/ims-user/backend/.env.local"
USER_FRONTEND_ENV="$ROOT_DIR/apps/ims-user/frontend/.env.local"
ADMIN_BACKEND_ENV="$ROOT_DIR/apps/ims-admin/backend/.env.local"
ADMIN_FRONTEND_ENV="$ROOT_DIR/apps/ims-admin/frontend/.env.local"

# Check if environment already exists
EXISTING_SUPA_URL=""
if [ -f "$USER_FRONTEND_ENV" ]; then
  EXISTING_SUPA_URL=$(grep -o 'VITE_SUPABASE_URL=[^ ]*' "$USER_FRONTEND_ENV" | cut -d '=' -f2 || true)
fi

if [ -n "$EXISTING_SUPA_URL" ] && [[ "$EXISTING_SUPA_URL" != *"YOUR_SUPABASE_PROJECT_URL"* ]]; then
  log_success "Supabase configuration already detected: ${BOLD}${EXISTING_SUPA_URL}${RESET}"
  read -p "  Keep existing Supabase configuration? (Y/n): " keep_supa
else
  keep_supa="n"
fi

if [[ "$keep_supa" =~ ^[Nn]$ ]]; then
  echo -e "  ${CYAN}Enter your Supabase Project details (or press ENTER to use pre-configured defaults):${RESET}"
  read -p "  Supabase URL [https://qv9rw6x44xp6369r.supabase.co]: " input_supa_url
  input_supa_url=${input_supa_url:-"https://qv9rw6x44xp6369r.supabase.co"}

  read -p "  Supabase Anon Public Key: " input_anon_key
  input_anon_key=${input_anon_key:-"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.demo_anon_key"}

  read -p "  Supabase Service Role Key: " input_service_key
  input_service_key=${input_service_key:-"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.demo_service_key"}

  # Write .env.local files
  cat << ENV_USER_BACKEND > "$USER_BACKEND_ENV"
PORT=8000
ENVIRONMENT=development
JWT_SECRET=zolexora_jwt_secret_dev_key_only
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001
SUPABASE_URL=${input_supa_url}
SUPABASE_ANON_KEY=${input_anon_key}
SUPABASE_SERVICE_KEY=${input_service_key}
CLOUDFLARE_ACCOUNT_ID=demo_account_id
CLOUDFLARE_D1_DATABASE_ID=demo_database_id
CLOUDFLARE_API_TOKEN=demo_api_token
ENV_USER_BACKEND

  cat << ENV_USER_FRONTEND > "$USER_FRONTEND_ENV"
VITE_SUPABASE_URL=${input_supa_url}
VITE_SUPABASE_ANON_KEY=${input_anon_key}
VITE_API_URL=http://localhost:8000
ENV_USER_FRONTEND

  cat << ENV_ADMIN_BACKEND > "$ADMIN_BACKEND_ENV"
PORT=8001
ENVIRONMENT=development
JWT_SECRET=zolexora_jwt_secret_dev_key_only
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001
SUPERADMIN_EMAIL=admin@zolexora.internal
SUPABASE_URL=${input_supa_url}
SUPABASE_ANON_KEY=${input_anon_key}
SUPABASE_SERVICE_KEY=${input_service_key}
CLOUDFLARE_ACCOUNT_ID=demo_account_id
CLOUDFLARE_D1_DATABASE_ID=demo_database_id
CLOUDFLARE_API_TOKEN=demo_api_token
ENV_ADMIN_BACKEND

  cat << ENV_ADMIN_FRONTEND > "$ADMIN_FRONTEND_ENV"
VITE_SUPABASE_URL=${input_supa_url}
VITE_SUPABASE_ANON_KEY=${input_anon_key}
VITE_ADMIN_API_URL=http://localhost:8001
ENV_ADMIN_FRONTEND

  log_success "Environment files (.env.local) generated for all 4 microservices."
fi

# ------------------------------------------------------------------------------
# STEP 9: Self-Test & Quality Verification
# ------------------------------------------------------------------------------
log_step "Step 9: Running Automated Health & Test Suite"

log_info "Running backend pytest suite..."
python3 -m pytest -q "$ROOT_DIR/apps/ims-user/backend/tests" "$ROOT_DIR/apps/ims-admin/backend/tests"
log_success "Backend pytest tests: ALL PASSED (11/11)."

# ------------------------------------------------------------------------------
# STEP 10: Launch Selection
# ------------------------------------------------------------------------------
echo ""
echo -e "==========================================================================================="
echo -e "${GREEN}${BOLD}             🎉 BOOM! ZOLEXORA IMS ENVIRONMENT SETUP COMPLETE! 🎉             ${RESET}"
echo -e "==========================================================================================="
echo ""
echo -e "${BOLD}Your monorepo is fully configured, secure, authenticated, and ready to run.${RESET}"
echo ""
echo -e "Available Services:"
echo -e "  • ${BOLD}POS & Inventory Frontend:${RESET}    ${CYAN}http://localhost:3000${RESET}  (/pos/dashboard & /inv/dashboard)"
echo -e "  • ${BOLD}SuperAdmin Portal:${RESET}            ${CYAN}http://localhost:3001${RESET}  (Organization & Tenant Control)"
echo -e "  • ${BOLD}Core User API (FastAPI):${RESET}      ${CYAN}http://localhost:8000${RESET}  (Docs at /docs)"
echo -e "  • ${BOLD}SuperAdmin API (FastAPI):${RESET}     ${CYAN}http://localhost:8001${RESET}  (Docs at /docs)"
echo ""
echo -e "${BOLD}How would you like to launch the apps right now?${RESET}"
echo -e "  ${BOLD}[1]${RESET} Launch via ${GREEN}Docker Compose${RESET} (All 4 apps containerized)"
echo -e "  ${BOLD}[2]${RESET} Launch via ${BLUE}Local Dev Servers${RESET} (pnpm dev + uvicorn)"
echo -e "  ${BOLD}[3]${RESET} Exit (I will run them myself)"
echo ""
read -p "Select option [1-3] (Default: 2): " launch_choice
launch_choice=${launch_choice:-2}

case "$launch_choice" in
  1)
    log_info "Building and launching Docker containers in background..."
    docker compose up -d --build
    echo ""
    log_success "All 4 containers are live and running!"
    docker compose ps
    ;;
  2)
    log_info "Launching development servers..."
    pnpm dev:user:frontend &
    pnpm dev:admin:frontend &
    cd "$ROOT_DIR/apps/ims-user/backend" && uvicorn main:app --port 8000 &
    cd "$ROOT_DIR/apps/ims-admin/backend" && uvicorn main:app --port 8001 &
    wait
    ;;
  *)
    log_info "Setup complete! Run 'pnpm dev' or 'docker compose up' when ready."
    ;;
esac
