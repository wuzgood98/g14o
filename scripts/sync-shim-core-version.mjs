import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const corePkgPath = join(root, "packages/core/package.json");
const shimPaths = ["packages/utils/package.json"];

const corePkg = JSON.parse(readFileSync(corePkgPath, "utf8"));
const coreVersion = corePkg.version;

if (!coreVersion || typeof coreVersion !== "string") {
  throw new Error(`Missing version in ${corePkgPath}`);
}

const specifier = `workspace:^${coreVersion}`;
let changed = 0;

for (const relativePath of shimPaths) {
  const pkgPath = join(root, relativePath);
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const current = pkg.dependencies?.["@g14o/core"];

  if (current === specifier) {
    console.log(`${relativePath}: already ${specifier}`);
    continue;
  }

  if (!pkg.dependencies) {
    pkg.dependencies = {};
  }
  pkg.dependencies["@g14o/core"] = specifier;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`${relativePath}: ${current ?? "(missing)"} -> ${specifier}`);
  changed++;
}

if (changed === 0) {
  console.log(`All shim packages already use ${specifier}`);
} else {
  console.log(`Updated ${changed} shim package(s) to ${specifier}`);
}
