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
echo "  1. Sign up at https://app.infisical.com (free)"
echo "  2. Create a project called: zolexora-platform"
echo "  3. Create 3 environments: dev, staging, prod"
echo "  4. Under each environment, create secret folders:"
echo ""
echo "       /zolexora-ims"
echo "       /zolexora-marketplace"
echo "       /zolexora-ai"
echo "       /zolexora-erp"
echo "       /zolexora-tms"
echo "       /zolexora-engage"
echo "       /clarity-fi"
echo "       /maun-kavach"
echo "       /rento-easy"
echo "       /the-textile-care"
echo "       /platform-admin"
echo "       /shared      ← Cloudinary, shared keys"
echo ""
echo "  5. Add secrets to each folder using config/envs/<product>/*.env.example as reference"
echo ""
echo "  6. Create a Machine Identity (Settings → Machine Identities → Add)"
echo "     and copy the Client ID and Client Secret."
echo ""
echo "  7. Add them to GitHub Actions Secrets:"
echo "       INFISICAL_CLIENT_ID"
echo "       INFISICAL_CLIENT_SECRET"
echo ""
echo "  8. Login locally:"
echo -e "       ${BLUE}infisical login${NC}"
echo ""
echo "  9. Link this repo to your project:"
echo -e "       ${BLUE}infisical init${NC}"
echo "     (Paste your workspace ID when prompted — found in Infisical Project Settings)"
echo ""
echo "  10. Run any product:"
echo -e "       ${BLUE}./scripts/setup/start.sh${NC}"
echo ""
echo -e "${GREEN}✔ Setup guide complete!${NC}"
