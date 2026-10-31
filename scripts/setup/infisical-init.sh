#!/bin/bash
# Zolexora Platform — Infisical First-Time Setup Guide
# Run this once after cloning the repo.
set -e

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo -e "${BLUE}"
echo "=========================================================="
echo "       🔐  INFISICAL SECRETS SETUP — ZOLEXORA  🔐       "
echo "=========================================================="
echo -e "${NC}"

# Step 1: Install CLI
if ! command -v infisical >/dev/null 2>&1; then
  echo -e "${YELLOW}Installing Infisical CLI...${NC}"
  curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.deb.sh' | sudo bash
  sudo apt-get install -y infisical
  echo -e "${GREEN}✔ Infisical CLI installed.${NC}"
else
  echo -e "${GREEN}✔ Infisical CLI already installed: $(infisical --version)${NC}"
fi

echo ""
echo -e "${YELLOW}Next Steps (manual):${NC}"
echo ""
echo "  Infisical is the ONLY secret source — there are no .env files or templates."
echo ""
echo "  1. Log in:            infisical login"
echo "  2. Products read their folder from <product>/.infisical.json, under project"
echo "     c4ac7d07-… → /Zolexora_Specfic_Credentials/<Product> (e.g. Zolexora_TMS)."
echo "  3. Add each product's keys to its folder — key names: docs/secrets.md"
echo "  4. Run anything that needs secrets via:"
echo -e "       ${BLUE}bash scripts/setup/with-infisical.sh <product-dir> <command>${NC}"
echo "  5. CI/servers: create a Machine Identity and set GitHub secrets"
echo "       INFISICAL_CLIENT_ID / INFISICAL_CLIENT_SECRET (or export INFISICAL_TOKEN)"
echo ""
