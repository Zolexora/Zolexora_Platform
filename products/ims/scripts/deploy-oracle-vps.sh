#!/usr/bin/env bash
# ==============================================================================
# Zolexora IMS — Oracle Cloud Always-Free VPS Container Auto-Provisioner
# Automatically configures an Oracle Cloud (4 OCPU / 24GB RAM Always-Free) VM,
# installs Docker, Docker Compose, sets firewall rules, and starts container stack
# Usage: Run directly on your Ubuntu/Debian VPS:
#   curl -fsSL https://raw.githubusercontent.com/Zolexora/Zolexora_IMS/dev/scripts/deploy-oracle-vps.sh | bash
# ==============================================================================

set -eo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}"
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║          ZOLEXORA IMS — ORACLE CLOUD ALWAYS-FREE DEPLOYER           ║"
echo "║        4 ARM vCPU • 24 GB RAM • 200 GB Storage • 24/7 No-Sleep       ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root or with sudo.${NC}"
   exit 1
fi

echo -e "${BLUE}${BOLD}[1/4] Updating System Packages & Installing Prerequisites...${NC}"
apt-get update -y && apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg lsb-release git ufw

echo -e "${BLUE}${BOLD}[2/4] Installing Docker Engine & Docker Compose Plugin...${NC}"
if ! command -v docker >/dev/null 2>&1; then
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
  echo -e "${GREEN}✓ Docker Engine successfully installed.${NC}"
else
  echo -e "${GREEN}✓ Docker is already installed.${NC}"
fi

echo -e "${BLUE}${BOLD}[3/4] Configuring Network Firewall (Ports 80, 443, 8000, 8001)...${NC}"
ufw allow 22/tcp || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw allow 8000/tcp || true
ufw allow 8001/tcp || true
# Oracle Linux iptables rules
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8000 -j ACCEPT 2>/dev/null || true
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8001 -j ACCEPT 2>/dev/null || true

echo -e "${BLUE}${BOLD}[4/4] Starting Containerized Microservices...${NC}"
REPO_DIR="/opt/zolexora-ims"
if [[ ! -d "${REPO_DIR}" ]]; then
  git clone -b dev https://github.com/Zolexora/Zolexora_IMS.git "${REPO_DIR}"
fi

cd "${REPO_DIR}"
git pull origin dev

echo -e "Starting Docker stack with compose..."
docker compose up -d --build

echo -e "\n${GREEN}${BOLD}══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  🎉 SUCCESS! Zolexora IMS is running 24/7 on your Always-Free VPS!   ${NC}"
echo -e "${GREEN}${BOLD}  API Services:                                                       ${NC}"
echo -e "  • User Core API:  http://$(curl -s ifconfig.me):8000/health"
echo -e "  • Admin API:      http://$(curl -s ifconfig.me):8001/health"
echo -e "${GREEN}${BOLD}══════════════════════════════════════════════════════════════════════${NC}\n"
