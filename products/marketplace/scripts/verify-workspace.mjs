import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const required = new Map([
  ["@zolexora/storefront-zolexora-shop", "apps/storefronts/zolexora-shop/web"],
  ["@zolexora/storefront-zolexora-shop-mobile", "apps/storefronts/zolexora-shop/mobile"],
  ["@zolexora/storefront-mahila-madel", "apps/storefronts/mahila-madel/web"],
  ["@zolexora/storefront-mahila-madel-mobile", "apps/storefronts/mahila-madel/mobile"],
  ["@zolexora/mahila-legacy-server", "apps/storefronts/mahila-madel/legacy-server"],
  ["@zolexora/seller-portal", "apps/portals/seller/web"],
  ["@zolexora/seller-portal-mobile", "apps/portals/seller/mobile"],
  ["@zolexora/marketplace-admin", "apps/portals/marketplace-admin/web"],
  ["@zolexora/shared-api", "packages/shared-api"],
  ["@zolexora/shared-config", "packages/shared-config"],
]);
const stale = ["apps/ZolexoraShop", "apps/MahilaMadel", "apps/web-buyer", "apps/web-seller", "apps/web-admin", "apps/mobile", "backend"];

let inventory;
try {
  inventory = JSON.parse(execFileSync("pnpm", ["list", "-r", "--depth", "-1", "--json"], {
    cwd: root,
    encoding: "utf8",
  }));
} catch (error) {
  console.error("Workspace inventory failed:", error.message);
  process.exit(1);
}

const failures = [];
const packages = inventory.filter(({ path }) => relative(root, path) !== "");
for (const [name, path] of required) {
  const matches = packages.filter((item) => item.name === name);
  if (matches.length !== 1) failures.push(`${name}: expected once, found ${matches.length}`);
  const manifestPath = join(root, path, "package.json");
  if (!existsSync(manifestPath)) {
    failures.push(`${name}: missing ${path}/package.json`);
    continue;
  }
  if (matches.length === 1 && relative(root, matches[0].path) !== path) {
    failures.push(`${name}: expected ${path}, found ${relative(root, matches[0].path)}`);
  }
  const { scripts = {} } = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (["@zolexora/storefront-zolexora-shop", "@zolexora/storefront-zolexora-shop-mobile", "@zolexora/storefront-mahila-madel-mobile", "@zolexora/seller-portal", "@zolexora/seller-portal-mobile", "@zolexora/marketplace-admin"].includes(name)) {
    for (const task of ["build", "type-check"]) if (!scripts[task]) failures.push(`${name}: missing ${task} script`);
  }
  if (name === "@zolexora/storefront-mahila-madel" && (!scripts.build || !scripts.test)) failures.push(`${name}: missing build or test script`);
  if (name === "@zolexora/shared-api" && (!scripts.build || !scripts["type-check"])) {
    failures.push(`${name}: missing build or type-check validation`);
  }
}
for (const path of stale) {
  if (packages.some((item) => relative(root, item.path) === path) || existsSync(join(root, path))) {
    failures.push(`stale workspace path present: ${path}`);
  }
}
for (const { name, path } of packages) {
  if (!required.has(name)) failures.push(`unexpected workspace package: ${name} (${relative(root, path)})`);
}

const mahilaRoot = join(root, required.get("@zolexora/storefront-mahila-madel"));
try {
  const mahilaRequire = createRequire(join(mahilaRoot, "package.json"));
  const { version } = mahilaRequire("eslint/package.json");
  if (Number.parseInt(version, 10) !== 8) {
    failures.push(`Mahila react-scripts requires ESLint 8, resolved ${version}`);
  }
} catch (error) {
  failures.push(`Mahila ESLint resolution failed: ${error.message}`);
}

console.table(packages.map(({ name, path }) => ({ package: name, path: relative(root, path) })));
if (failures.length) {
  console.error(`Workspace verification failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`Workspace verified: ${required.size} required packages.`);
