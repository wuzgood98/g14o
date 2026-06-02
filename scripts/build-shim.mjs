import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

/**
 * Writes static ESM re-export shims (no bundler / DTS compiler).
 *
 * Usage:
 *   node scripts/build-shim.mjs --cwd packages/cache index:@g14o/core/cache
 *   node scripts/build-shim.mjs --cwd packages/utils utils:@g14o/core types:@g14o/core/types config:@g14o/core/config
 */
const args = process.argv.slice(2);
let cwd = process.cwd();
const exports = [];

for (let index = 0; index < args.length; index++) {
  const arg = args[index];
  if (arg === "--cwd") {
    const next = args[index + 1];
    if (!next) {
      throw new Error("Missing value for --cwd");
    }
    cwd = join(root, "..", next);
    index++;
    continue;
  }
  if (!arg.includes(":")) {
    throw new Error(
      `Invalid export mapping "${arg}". Expected name:target (e.g. index:@g14o/core/cache).`
    );
  }
  const colonIndex = arg.indexOf(":");
  exports.push({
    name: arg.slice(0, colonIndex),
    target: arg.slice(colonIndex + 1),
  });
}

if (exports.length === 0) {
  throw new Error("Provide at least one export mapping: name:target");
}

const distDir = join(cwd, "dist");
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

for (const { name, target } of exports) {
  const relativeDir = dirname(name);
  const fileStem = basename(name);
  let fileBase = fileStem;
  if (fileStem.endsWith(".js")) {
    fileBase = fileStem.slice(0, -3);
  } else if (fileStem.endsWith(".d.ts")) {
    fileBase = fileStem.slice(0, -5);
  }
  const outDir = join(distDir, relativeDir === "." ? "" : relativeDir);
  mkdirSync(outDir, { recursive: true });

  const jsPath = join(outDir, `${fileBase}.js`);
  const dtsPath = join(outDir, `${fileBase}.d.ts`);
  const content = `export * from "${target}";\n`;

  writeFileSync(jsPath, content);
  writeFileSync(dtsPath, content);
}

console.log(`Wrote ${exports.length} shim re-export(s) to ${distDir}`);
