/**
 * Framework-agnostic rate limiting for `@g14o/core/ratelimit`.
 *
 * Use {@link createRateLimit} for app-owned instances (`lib/rate-limit.ts`).
 *
 * @packageDocumentation
 */

export type {
  CreateRateLimitOptions,
  RateLimitClient,
  RateLimitTierConfig,
  RateLimitTiersOverride,
} from "./create-rate-limit-client";
/** biome-ignore lint/performance/noBarrelFile: public package entry re-export */
export { createRateLimit } from "./create-rate-limit-client";
export {
  getDefaultIdentifier,
  getTokenConfigReadonly,
  type RateLimitCheckResult,
  type RateLimiterAdapter,
  type RateLimitOptions,
  type RateLimitResultData,
  type RateLimitTier,
  type ReadonlyTokenConfigMap,
  type TokenConfig,
  tokenConfigSnapshot,
} from "./internals";
export type { Duration, Unit } from "./parse-duration";
export { parseDurationToMs } from "./parse-duration";
