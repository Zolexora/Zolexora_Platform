#!/bin/bash
# Zolexora Platform - Universal Start Script
set -e

# Always run from the repository root
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$REPO_ROOT"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "=========================================================="
echo "          🚀 ZOLEXORA PLATFORM STARTUP SCRIPT 🚀          "
echo "=========================================================="
echo -e "${NC}"

# 1. Dependency Checks
echo -e "${YELLOW}Checking dependencies...${NC}"
command -v docker >/dev/null 2>&1 || { echo >&2 "Docker is required but not installed. Aborting."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo -e "pnpm not found. Installing via npm..."; npm install -g pnpm; }

# 2. Install workspace dependencies
echo -e "\n${YELLOW}Installing monorepo dependencies (pnpm install)...${NC}"
pnpm install --ignore-scripts || true

# 3. Find available products with compose.yaml
echo -e "\n${YELLOW}Scanning for Dockerized products...${NC}"
PRODUCTS=()
PATHS=()

# Include root compose for "All Products"
PRODUCTS+=("All Products (Root Compose)")
PATHS+=("compose.yaml")

for file in $(find products apps -maxdepth 2 -name "compose.yaml" -o -name "docker-compose.yml" 2>/dev/null); do
    dir=$(dirname "$file")
    product_name=$(basename "$dir")
    PRODUCTS+=("$product_name")
    PATHS+=("$file")
done

# 4. Interactive Menu
echo -e "\nWhich product would you like to start?"
for i in "${!PRODUCTS[@]}"; do
    echo "$((i+1)). ${PRODUCTS[$i]}"
done
echo "$(( ${#PRODUCTS[@]} + 1 )). Stop/Down all products"
echo "$(( ${#PRODUCTS[@]} + 2 )). Exit"

read -p "Select an option [1-$(( ${#PRODUCTS[@]} + 2 ))]: " OPTION

if [ "$OPTION" -eq "$(( ${#PRODUCTS[@]} + 2 ))" ]; then
    echo "Exiting."
    exit 0
elif [ "$OPTION" -eq "$(( ${#PRODUCTS[@]} + 1 ))" ]; then
    echo -e "\n${YELLOW}Stopping all containers...${NC}"
    for compose_file in "${PATHS[@]}"; do
        docker compose -f "$compose_file" down 2>/dev/null || true
    done
    echo -e "${GREEN}All containers stopped!${NC}"
    exit 0
fi

# Validation
if [ "$OPTION" -lt 1 ] || [ "$OPTION" -gt "${#PRODUCTS[@]}" ]; then
    echo "Invalid option."
    exit 1
fi

SELECTED_INDEX=$((OPTION-1))
SELECTED_NAME="${PRODUCTS[$SELECTED_INDEX]}"
SELECTED_PATH="${PATHS[$SELECTED_INDEX]}"
SELECTED_DIR=$(dirname "$SELECTED_PATH")

echo -e "\n${GREEN}Starting $SELECTED_NAME...${NC}"

# 5. Environment variable handling
if [ ! -f "$SELECTED_DIR/.env" ] && [ -f "$SELECTED_DIR/.env.example" ]; then
    echo -e "${YELLOW}Missing .env file in $SELECTED_DIR. Copying from .env.example...${NC}"
    cp "$SELECTED_DIR/.env.example" "$SELECTED_DIR/.env"
fi

# 6. Run Docker Compose
cd "$SELECTED_DIR"
docker compose up -d --build

echo -e "\n=========================================================="
echo -e "${GREEN}✅ $SELECTED_NAME is now running in the background!${NC}"
echo -e "To view logs, run: ${BLUE}docker compose -f $SELECTED_PATH logs -f${NC}"
echo -e "To stop, run: ${BLUE}docker compose -f $SELECTED_PATH down${NC}"
echo -e "=========================================================="
