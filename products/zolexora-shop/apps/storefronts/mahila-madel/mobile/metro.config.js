const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
let monorepoRoot = projectRoot;
while (monorepoRoot !== path.dirname(monorepoRoot)) {
  if (fs.existsSync(path.join(monorepoRoot, "pnpm-workspace.yaml"))) {
    break;
  }
  monorepoRoot = path.dirname(monorepoRoot);
}

const config = getDefaultConfig(projectRoot);
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
