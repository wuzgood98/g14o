import { execSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARBALL_VERSION_SUFFIX = /-\d+\.\d+\.\d+\.tgz$/;

function tarballToPackageName(filename) {
  const base = filename.replace(TARBALL_VERSION_SUFFIX, "");
  if (base.startsWith("g14o-")) {
    return `@g14o/${base.slice("g14o-".length)}`;
  }
  throw new Error(`Unrecognized packed tarball name: ${filename}`);
}

const coreSubpaths = [
  {
    importPath: "@g14o/core",
    distFile: "dist/utils.js",
    exports: [
      "configureUtils",
      "createRedisClient",
      "parseNumber",
      "resolveRedisClient",
      "stringifyParams",
    ],
  },
  {
    importPath: "@g14o/core/cache",
    distFile: "dist/cache/index.js",
    exports: ["createCache", "withCache", "getCache", "createCacheKey"],
  },
  {
    importPath: "@g14o/core/ratelimit",
    distFile: "dist/ratelimit/index.js",
    exports: [
      "createRateLimit",
      "checkRateLimit",
      "withRateLimit",
      "parseDurationToMs",
    ],
    typesOnlyInNode: true,
  },
];

const shimPackages = [
  {
    filter: "@g14o/utils",
    importPath: "@g14o/utils",
    distFile: "dist/utils.js",
    exports: ["parseNumber", "stringifyParams"],
  },
  {
    filter: "@g14o/cache",
    importPath: "@g14o/cache",
    distFile: "dist/index.js",
    exports: ["createCache", "withCache"],
  },
  {
    filter: "@g14o/ratelimit",
    importPath: "@g14o/ratelimit",
    distFile: "dist/index.js",
    exports: ["createRateLimit", "checkRateLimit"],
    typesOnlyInNode: true,
  },
];

const shimToCore = {
  "@g14o/utils": "@g14o/core",
  "@g14o/cache": "@g14o/core/cache",
  "@g14o/ratelimit": "@g14o/core/ratelimit",
};

const packDir = mkdtempSync(join(tmpdir(), "g14o-pack-"));
const consumerDir = mkdtempSync(join(tmpdir(), "g14o-consumer-"));

try {
  const filters = ["@g14o/core", ...shimPackages.map((p) => p.filter)];
  for (const filter of filters) {
    execSync(`pnpm --filter ${filter} pack --pack-destination "${packDir}"`, {
      cwd: root,
      stdio: "pipe",
    });
  }

  const tarballs = readdirSync(packDir).filter((name) => name.endsWith(".tgz"));
  if (tarballs.length !== filters.length) {
    throw new Error(
      `Expected ${filters.length} tarballs in ${packDir}, found: ${tarballs.join(", ")}`
    );
  }

  const tarballByScope = Object.fromEntries(
    tarballs.map((file) => [
      tarballToPackageName(file),
      `file:${join(packDir, file).replace(/\\/g, "/")}`,
    ])
  );

  for (const filter of filters) {
    if (!tarballByScope[filter]) {
      throw new Error(
        `Missing tarball mapping for ${filter}. Found: ${Object.keys(tarballByScope).join(", ")}`
      );
    }
  }

  writeFileSync(
    join(consumerDir, "package.json"),
    `${JSON.stringify(
      {
        name: "g14o-smoke-consumer",
        private: true,
        type: "module",
        dependencies: {
          ...tarballByScope,
          react: "19.2.7",
          next: "16.2.6",
        },
        pnpm: {
          overrides: {
            "@g14o/core": tarballByScope["@g14o/core"],
          },
        },
      },
      null,
      2
    )}\n`
  );

  execSync("pnpm install --no-frozen-lockfile", {
    cwd: consumerDir,
    stdio: "inherit",
  });

  const coreRoot = join(consumerDir, "node_modules", "@g14o", "core");
  const corePkg = JSON.parse(
    readFileSync(join(coreRoot, "package.json"), "utf8")
  );

  for (const {
    importPath,
    distFile,
    exports: names,
    typesOnlyInNode,
  } of coreSubpaths) {
    const entryPath = join(coreRoot, distFile);
    if (!existsSync(entryPath)) {
      throw new Error(`${importPath}: missing packed entry ${distFile}`);
    }

    const exportKey =
      importPath === "@g14o/core" ? "." : importPath.replace("@g14o/core", ".");
    const packedExport =
      exportKey === "." ? corePkg.exports?.["."] : corePkg.exports?.[exportKey];
    const importTarget =
      typeof packedExport === "string" ? packedExport : packedExport?.import;
    if (!importTarget?.includes("dist")) {
      throw new Error(
        `${importPath}: packed export must point at dist (got ${JSON.stringify(packedExport)})`
      );
    }

    if (typesOnlyInNode) {
      const dtsPath = join(coreRoot, distFile.replace(".js", ".d.ts"));
      const dts = readFileSync(dtsPath, "utf8");
      for (const name of names) {
        if (!dts.includes(name)) {
          throw new Error(
            `${importPath}: expected export "${name}" in ${dtsPath}`
          );
        }
      }
    } else {
      const mod = await import(pathToFileURL(entryPath).href);
      for (const name of names) {
        if (typeof mod[name] !== "function") {
          throw new Error(
            `${importPath}: expected function export "${name}" in packed tarball`
          );
        }
      }
    }

    console.log(`${importPath}: packed smoke OK (${names.join(", ")})`);
  }

  for (const {
    importPath,
    distFile,
    exports: names,
    typesOnlyInNode,
  } of shimPackages) {
    const pkgName = importPath.split("/")[1];
    const pkgRoot = join(consumerDir, "node_modules", "@g14o", pkgName);
    const entryPath = join(pkgRoot, distFile);

    if (!existsSync(entryPath)) {
      throw new Error(`${importPath}: missing packed entry ${distFile}`);
    }

    const packedPkg = JSON.parse(
      readFileSync(join(pkgRoot, "package.json"), "utf8")
    );
    const rootExport = packedPkg.exports?.["."];
    const importTarget =
      typeof rootExport === "string" ? rootExport : rootExport?.import;
    if (!importTarget?.includes("dist")) {
      throw new Error(
        `${importPath}: packed export must point at dist (got ${JSON.stringify(rootExport)})`
      );
    }

    if (typesOnlyInNode) {
      const dts = readFileSync(
        join(pkgRoot, distFile.replace(".js", ".d.ts")),
        "utf8"
      );
      const coreTarget = shimToCore[importPath];
      if (!dts.includes(coreTarget)) {
        throw new Error(
          `${importPath}: expected re-export of "${coreTarget}" in shim dist types`
        );
      }
    } else {
      const mod = await import(pathToFileURL(entryPath).href);
      for (const name of names) {
        if (typeof mod[name] !== "function") {
          throw new Error(
            `${importPath}: expected function export "${name}" in shim tarball`
          );
        }
      }
    }

    console.log(`${importPath}: shim smoke OK (${names.join(", ")})`);
  }

  console.log("All packed smoke checks passed.");
} finally {
  for (const dir of [packDir, consumerDir]) {
    try {
      rmSync(dir, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200,
      });
    } catch {
      // Windows may briefly lock node_modules under consumerDir
    }
  }
}
