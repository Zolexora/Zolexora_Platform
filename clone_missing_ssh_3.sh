#!/bin/bash
set -e

cd /home/chickenman/Documents/projects/Zolexora/Zolexora_Platform/products

clone_and_merge() {
    REPO_URL=$1
    TARGET_DIR=$2
    TEMP_DIR="/tmp/temp_clone_ssh_3"
    
    echo "Cloning $REPO_URL to $TARGET_DIR..."
    rm -rf "$TEMP_DIR"
    if git clone "$REPO_URL" "$TEMP_DIR"; then
        mkdir -p "$TARGET_DIR"
        rm -rf "$TEMP_DIR/.git"
        cp -a "$TEMP_DIR"/* "$TARGET_DIR"/ || true
        cp -a "$TEMP_DIR"/.??* "$TARGET_DIR"/ 2>/dev/null || true
        rm -rf "$TEMP_DIR"
        echo "Successfully merged into $TARGET_DIR"
    else
        echo "Failed to clone $REPO_URL"
    fi
}

clone_and_merge "git@github.com:Zolexora/ZolexoraDeployment.git" "../infrastructure/ZolexoraDeployment"
