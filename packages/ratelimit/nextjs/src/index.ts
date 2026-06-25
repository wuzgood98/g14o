/** biome-ignore-all lint/performance/noBarrelFile: public package entry re-export */
/**
 * Next.js rate limiting for `@g14o/ratelimit-nextjs`.
 *
 * Use {@link createRateLimit} for app-owned instances (`lib/rate-limit.ts`).
 *
 * @packageDocumentation
 */

export type { Duration, Unit } from "@g14o/ratelimit";
export {
  getDefaultIdentifier,
  getTokenConfigReadonly,
  parseDurationToMs,
  type RateLimitCheckResult,
  type RateLimiterAdapter,
  type RateLimitOptions,
  type RateLimitResultData,
  type RateLimitTier,
  type RateLimitTierConfig,
  type RateLimitTiersOverride,
  type ReadonlyTokenConfigMap,
  type TokenConfig,
  tokenConfigSnapshot,
} from "@g14o/ratelimit";
export type {
  CreateRateLimitOptions,
  RateLimitClient,
} from "./create-rate-limit-client";
export { createRateLimit } from "./create-rate-limit-client";
