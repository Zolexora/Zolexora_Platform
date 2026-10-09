#!/usr/bin/env bash
set -euo pipefail

# Usage: version.sh [--prefix PREFIX]
# Prints the version string for a build based on git tags or commit shas.

PREFIX=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --prefix)
      PREFIX="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# Check if we are on a tag
if [[ -n "${PREFIX}" ]]; then
  TAG=$(git describe --tags --exact-match --match "${PREFIX}*" 2>/dev/null || echo "")
else
  TAG=$(git describe --tags --exact-match 2>/dev/null || echo "")
fi

if [[ -n "${TAG}" ]]; then
  # Strip prefix if it exists, otherwise strip leading 'v'
  if [[ -n "${PREFIX}" ]]; then
     VERSION="${TAG#$PREFIX}"
  else
     VERSION="${TAG#v}"
  fi
  echo "${VERSION}"
else
  # Fallback: {branch}-{short-sha}
  BRANCH=$(git rev-parse --abbrev-ref HEAD)
  # If we're in detached HEAD (like in CI), try to get branch from env or GITHUB_REF
  if [[ "${BRANCH}" == "HEAD" ]]; then
    if [[ -n "${GITHUB_REF_NAME:-}" ]]; then
      BRANCH="${GITHUB_REF_NAME}"
    else
      BRANCH="detached"
    fi
  fi
  
  # Sanitize branch name (replace slashes with dashes)
  BRANCH="${BRANCH//\//-}"
  
  SHORT_SHA=$(git rev-parse --short HEAD)
  echo "${BRANCH}-${SHORT_SHA}"
fi
