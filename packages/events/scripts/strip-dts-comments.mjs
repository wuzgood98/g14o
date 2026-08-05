import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = fileURLToPath(new URL("../dist", import.meta.url));

/** Strip block and line comments from declaration emit. */
function stripDeclarationComments(content) {
  return content
    .replace(/\/\*\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\n{3,}/g, "\n\n");
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!entry.endsWith(".d.mts") && !entry.endsWith(".d.ts")) {
      continue;
    }

    const source = readFileSync(fullPath, "utf8");
    writeFileSync(fullPath, stripDeclarationComments(source));
  }
}

walk(distDir);
