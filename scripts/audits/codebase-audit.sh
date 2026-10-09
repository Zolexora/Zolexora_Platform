#!/bin/bash
echo "=== 1. Repository Structure ==="
ls -la
echo "Apps:"
ls -la apps/ 2>/dev/null || ls -la products/ 2>/dev/null
echo "Workspaces:"
cat package.json 2>/dev/null | grep -A 5 "workspaces"
cat pnpm-workspace.yaml 2>/dev/null

echo "=== 2. CI/CD Maturity ==="
ls -la .github/workflows/ 2>/dev/null
ls -la .github/scripts/ 2>/dev/null

echo "=== 3. Docker & Infrastructure ==="
find . -maxdepth 3 -name "Dockerfile" -o -name "compose.yaml" -o -name "nginx.conf" | grep -v node_modules

echo "=== 4. Code Quality & Standards ==="
find . -maxdepth 3 -name ".eslintrc*" -o -name "*prettierrc*" -o -name "tsconfig.json" -o -name "ruff.toml" -o -name "biome.json" | grep -v node_modules

echo "=== 5. Testing Coverage ==="
find . -maxdepth 3 -name "jest.config.*" -o -name "vitest.config.*" -o -name "pytest.ini" | grep -v node_modules
echo "Test files count:"
find . -name "*.test.*" -o -name "*.spec.*" | grep -v node_modules | wc -l

echo "=== 6. Security Posture ==="
ls -la CODEOWNERS .github/CODEOWNERS docs/CODEOWNERS 2>/dev/null
echo "Dependabot:"
ls -la .github/dependabot.yml 2>/dev/null

echo "=== 7. Documentation Quality ==="
ls -la docs/ 2>/dev/null

echo "=== 8. Dependency Management ==="
ls -la pnpm-lock.yaml package-lock.json yarn.lock 2>/dev/null

echo "=== 9. Developer Experience (DX) ==="
ls -la .devcontainer/ 2>/dev/null
ls -la turbo.json 2>/dev/null
ls -la scripts/ 2>/dev/null

echo "=== 10. Product Completeness ==="
for dir in products/* apps/*; do
  if [ -d "$dir" ]; then
    echo -n "$dir: "
    find "$dir" -type f -name "*.ts" -o -name "*.tsx" -o -name "*.py" -o -name "*.js" | grep -v node_modules | wc -l
  fi
done 2>/dev/null

