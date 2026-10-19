#!/bin/bash
# Zolexora Platform — Deep Docker Prune (Protects Workspace DevContainer)
# Behavior: Cleans unused Docker resources like 'docker system prune -a'
# BUT strictly safeguards:
#   - DevContainer workspace container & daemon
#   - DevContainer images (vsc-*, *devcontainer*)
#   - DevContainer persistent volume (vscode)

set -e

# Colors
GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  🧹 DEEP DOCKER PRUNE (SAFEGUARDING WORKSPACE DEVCONTAINER)    ${NC}"
echo -e "${BLUE}================================================================${NC}\n"

# 1. Clean stopped/exited containers (never touch devcontainer)
echo -e "${YELLOW}[1/4] Removing stopped containers (excluding devcontainer)...${NC}"
STOPPED_CONTAINERS=$(docker ps -a --filter "status=exited" --filter "status=created" --format '{{.ID}} {{.Image}} {{.Names}}' | grep -vE '(vsc-|devcontainer)' | awk '{print $1}' || true)
if [ -n "$STOPPED_CONTAINERS" ]; then
  docker rm -f $STOPPED_CONTAINERS >/dev/null 2>&1 || true
  echo -e "  ${GREEN}✔ Removed non-devcontainer stopped containers.${NC}"
else
  echo -e "  ${CYAN}ℹ No stopped containers to remove.${NC}"
fi

# 2. Prune unused networks
echo -e "${YELLOW}[2/4] Pruning unused networks...${NC}"
docker network prune -f >/dev/null 2>&1 || true
echo -e "  ${GREEN}✔ Networks pruned.${NC}"

# 3. Prune build cache
echo -e "${YELLOW}[3/4] Pruning Docker build cache...${NC}"
docker builder prune -f >/dev/null 2>&1 || true
echo -e "  ${GREEN}✔ Build cache pruned.${NC}"

# 4. Prune unused images while strictly protecting devcontainer
echo -e "${YELLOW}[4/4] Pruning unused product images (protecting vsc-* devcontainer)...${NC}"
# First remove untagged dangling images (excluding devcontainer)
DANGLING=$(docker images -f "dangling=true" -q || true)
if [ -n "$DANGLING" ]; then
  for d_id in $DANGLING; do
    # Verify it doesn't belong to a vsc image
    if ! docker inspect "$d_id" 2>/dev/null | grep -q "devcontainer"; then
      docker rmi "$d_id" >/dev/null 2>&1 || true
    fi
  done
fi

# Find all non-devcontainer named images
NON_DEV_IMAGES=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -vE '^(vsc-|.*devcontainer)' || true)
if [ -n "$NON_DEV_IMAGES" ]; then
  for img in $NON_DEV_IMAGES; do
    # docker rmi will safely skip any image currently used by a running container
    docker rmi "$img" >/dev/null 2>&1 || true
  done
  echo -e "  ${GREEN}✔ Cleaned unused product images (DevContainer images preserved).${NC}"
else
  echo -e "  ${CYAN}ℹ No non-devcontainer images to prune.${NC}"
fi

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}  ✅ Deep Prune Complete! DevContainer is 100% Protected.      ${NC}"
echo -e "${GREEN}================================================================${NC}\n"

echo -e "${CYAN}Protected DevContainer Images on Host:${NC}"
docker images --format '  - {{.Repository}}:{{.Tag}} ({{.Size}})' | grep "vsc-" || echo "  (DevContainer running)"

echo -e "\n${CYAN}Current Docker Disk Usage:${NC}"
docker system df
