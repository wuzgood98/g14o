import type { Environment, InMemoryEnvOptions } from "./types";

/**
 * Returns the effective environment name.
 *
 * @param env - Optional override; falls back to `process.env.NODE_ENV` or `"development"`.
 */
export function resolveEnvName(env?: Environment): string {
  return env ?? process.env.NODE_ENV ?? "development";
}

/** Static build/export phases where Redis REST calls break prerender (e.g. Next.js sets `NEXT_PHASE`). */
const STATIC_BUILD_PHASES = new Set(["phase-production-build", "phase-export"]);

/**
 * Whether the process is in a static build or export phase.
 *
 * Detects `NEXT_PHASE` values `phase-production-build` and `phase-export` (set by Next.js
 * during `next build` / static export). Has no effect on adapter selection unless
 * {@link InMemoryEnvOptions.inMemoryDuringBuild} is enabled (default `true`) via
 * `createCache()` or `createRateLimit()`.
 *
 * During these phases, Upstash Redis uses `fetch` with `cache: "no-store"`, which
 * frameworks may reject while prerendering static routes that call Redis-backed helpers.
 */
export function isBuildLikePhase(): boolean {
  const phase = process.env.NEXT_PHASE;
  return phase !== undefined && STATIC_BUILD_PHASES.has(phase);
}

/**
 * Whether the given environment uses in-memory cache/rate-limit backends.
 *
 * `"development"` and `"test"` always use in-memory adapters.
 *
 * In `"production"`, {@link InMemoryEnvOptions.inMemoryDuringBuild} defaults to
 * `true`: during {@link isBuildLikePhase}, the in-memory adapter is used so
 * static builds do not call Upstash. At runtime (no build phase),
 * production uses Redis when configured. Entries written to in-memory during build
 * are not copied to Upstash; Redis is populated on later runtime requests when
 * server code runs again.
 *
 * Set `inMemoryDuringBuild: false` to use Redis during production builds as well.
 * Expect `DYNAMIC_SERVER_USAGE` warnings, failed cache reads/writes during prerender
 * (with fallback to your underlying functions), and prerendered routes may become
 * dynamic (`ƒ`) in the build table. Use only for debugging or intentional build-time
 * Redis access.
 *
 * @param envName - Environment name (e.g. `"development"`, `"test"`, `"production"`).
 * @param options - Build-phase behavior; omitted fields use defaults (`inMemoryDuringBuild: true`).
 */
export function isInMemoryEnv(
  envName: string,
  options: InMemoryEnvOptions = {}
): boolean {
  const inMemoryDuringBuild = options.inMemoryDuringBuild ?? true;
  if (inMemoryDuringBuild && isBuildLikePhase()) {
    return true;
  }
  return envName === "development" || envName === "test";
}
