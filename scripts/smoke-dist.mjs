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

function smokeSchema(validate) {
  return { "~standard": { version: 1, vendor: "smoke", validate } };
}

function assertThrows(fn, predicate) {
  try {
    fn();
  } catch (error) {
    if (predicate(error)) {
      return;
    }
    throw new Error(`Unexpected error: ${error?.message ?? error}`);
  }
  throw new Error("Expected function to throw");
}

const passSchema = smokeSchema((value) => ({ value }));
const failSchema = smokeSchema(() => ({ issues: [{ message: "invalid" }] }));

const envCoreSmoke = {
  filter: "@g14o/env-core",
  importPath: "@g14o/env-core",
  distFile: "dist/index.mjs",
  exports: ["createEnv", "InvalidEnvironmentVariablesError"],
};

const loggerSmoke = {
  filter: "@g14o/logger",
  importPath: "@g14o/logger",
  distFile: "dist/index.mjs",
  exports: ["createLogger"],
};

const standalonePackages = [
  loggerSmoke,
  {
    filter: "@g14o/cache",
    importPath: "@g14o/cache",
    distFile: "dist/index.mjs",
    exports: ["createCache", "createCacheKey"],
  },
  {
    filter: "@g14o/ratelimit",
    importPath: "@g14o/ratelimit",
    distFile: "dist/index.mjs",
    exports: ["createRateLimit", "parseDurationToMs"],
  },
  {
    filter: "@g14o/ratelimit-nextjs",
    importPath: "@g14o/ratelimit-nextjs",
    distFile: "dist/index.mjs",
    exports: ["createRateLimit", "parseDurationToMs"],
  },
  {
    filter: "@g14o/ratelimit-express",
    importPath: "@g14o/ratelimit-express",
    distFile: "dist/index.mjs",
    exports: ["createRateLimit", "parseDurationToMs", "adaptExpressRequest"],
  },
  {
    filter: "@g14o/ratelimit-hono",
    importPath: "@g14o/ratelimit-hono",
    distFile: "dist/index.mjs",
    exports: [
      "createRateLimit",
      "parseDurationToMs",
      "rateLimitExceededResponse",
    ],
  },
];

const packDir = mkdtempSync(join(tmpdir(), "g14o-pack-"));
const consumerDir = mkdtempSync(join(tmpdir(), "g14o-consumer-"));

try {
  const filters = [
    envCoreSmoke.filter,
    ...standalonePackages.map((p) => p.filter),
  ];
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
          "@upstash/ratelimit": "^2.0.5",
          "@upstash/redis": "^1.34.0",
          express: "^5.1.0",
          hono: "^4.12.27",
          react: "19.2.7",
          next: "16.2.6",
        },
        pnpm: {
          overrides: {
            "@g14o/ratelimit": tarballByScope["@g14o/ratelimit"],
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

  {
    const { importPath, distFile } = envCoreSmoke;
    const pkgRoot = join(consumerDir, "node_modules", "@g14o", "env-core");
    const entryPath = join(pkgRoot, distFile);

    if (!existsSync(entryPath)) {
      throw new Error(`${importPath}: missing packed entry ${distFile}`);
    }

    const packedPkg = JSON.parse(
      readFileSync(join(pkgRoot, "package.json"), "utf8")
    );
    if (
      packedPkg.dependencies &&
      Object.keys(packedPkg.dependencies).length > 0
    ) {
      throw new Error(
        `@g14o/env-core: expected no runtime dependencies (got ${JSON.stringify(packedPkg.dependencies)})`
      );
    }

    const rootExport = packedPkg.exports?.["."];
    if (!rootExport) {
      throw new Error(
        `${importPath}: packed package.json must define exports["."] (got ${JSON.stringify(packedPkg.exports)})`
      );
    }
    const importTarget =
      typeof rootExport === "string"
        ? rootExport
        : (rootExport?.default ?? rootExport?.import);
    if (!importTarget?.includes("dist")) {
      throw new Error(
        `${importPath}: packed export "." must point at dist (got ${JSON.stringify(rootExport)})`
      );
    }

    const mod = await import(pathToFileURL(entryPath).href);
    if (typeof mod.createEnv !== "function") {
      throw new Error(`${importPath}: expected function export "createEnv"`);
    }
    if (typeof mod.InvalidEnvironmentVariablesError !== "function") {
      throw new Error(
        `${importPath}: expected class export "InvalidEnvironmentVariablesError"`
      );
    }

    const { createEnv, InvalidEnvironmentVariablesError } = mod;

    const skipEnv = createEnv({
      server: { SMOKE: failSchema },
      runtimeEnv: { SMOKE: "ok" },
      isServer: true,
      skipValidation: true,
    });
    if (skipEnv.SMOKE !== "ok") {
      throw new Error(
        `${importPath}: createEnv skipValidation smoke returned unexpected value`
      );
    }

    const validEnv = createEnv({
      server: { SMOKE: passSchema },
      runtimeEnv: { SMOKE: "ok" },
      isServer: true,
    });
    if (validEnv.SMOKE !== "ok") {
      throw new Error(
        `${importPath}: createEnv validation smoke returned unexpected value`
      );
    }

    assertThrows(
      () =>
        createEnv({
          server: { BAD: failSchema },
          runtimeEnv: { BAD: "x" },
          isServer: true,
        }),
      (error) => error instanceof InvalidEnvironmentVariablesError
    );

    assertThrows(
      () =>
        createEnv({
          server: { BAD: failSchema },
          runtimeEnv: { BAD: "x" },
          isServer: true,
          onValidationError: (issues) => {
            if (issues[0]?.path?.[0]?.key !== "BAD") {
              throw new Error(
                `${importPath}: onValidationError issue path missing BAD key`
              );
            }
            throw new Error("smoke-validation");
          },
        }),
      (error) => error.message === "smoke-validation"
    );

    const clientEnv = createEnv({
      server: { SECRET: passSchema },
      runtimeEnv: { SECRET: "hidden" },
      isServer: false,
    });
    assertThrows(
      () => clientEnv.SECRET,
      (error) => error.message.includes("SECRET")
    );

    const customAccessEnv = createEnv({
      server: { SECRET: passSchema },
      runtimeEnv: { SECRET: "hidden" },
      isServer: false,
      onInvalidAccess: () => {
        throw new Error("smoke-access");
      },
    });
    assertThrows(
      () => customAccessEnv.SECRET,
      (error) => error.message === "smoke-access"
    );

    console.log(
      `${importPath}: packed smoke OK (createEnv, skipValidation, validation, onValidationError, onInvalidAccess)`
    );
  }

  for (const { importPath, distFile, exports: names } of standalonePackages) {
    const pkgName = importPath.split("/")[1];
    const pkgRoot = join(consumerDir, "node_modules", "@g14o", pkgName);
    const entryPath = join(pkgRoot, distFile);

    if (!existsSync(entryPath)) {
      throw new Error(`${importPath}: missing packed entry ${distFile}`);
    }

    const packedPkg = JSON.parse(
      readFileSync(join(pkgRoot, "package.json"), "utf8")
    );

    if (
      importPath === loggerSmoke.importPath &&
      packedPkg.dependencies &&
      Object.keys(packedPkg.dependencies).length > 0
    ) {
      throw new Error(
        `${importPath}: expected no runtime dependencies (got ${JSON.stringify(packedPkg.dependencies)})`
      );
    }

    const rootExport = packedPkg.exports?.["."];
    const importTarget =
      typeof rootExport === "string"
        ? rootExport
        : (rootExport?.default ?? rootExport?.import);
    if (!importTarget?.includes("dist")) {
      throw new Error(
        `${importPath}: packed export must point at dist (got ${JSON.stringify(rootExport)})`
      );
    }

    const mod = await import(pathToFileURL(entryPath).href);
    for (const name of names) {
      if (typeof mod[name] !== "function") {
        throw new Error(
          `${importPath}: expected function export "${name}" in packed tarball`
        );
      }
    }

    console.log(`${importPath}: standalone smoke OK (${names.join(", ")})`);
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
