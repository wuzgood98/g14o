/** biome-ignore-all lint/performance/noBarrelFile: public package entry re-export */
/**
 * Next.js rate limiting for `@g14o/ratelimit-nextjs`.
 *
 * Use {@link createRateLimit} for app-owned instances (`lib/rate-limit.ts`).
 *
 * @packageDocumentation
 */

export type {
  Duration,
  RateLimitStore,
  RateLimitStoreConfig,
  RateLimitStoreLimiter,
  Unit,
} from "@g14o/ratelimit";
export {
  createStore,
  defineStore,
  getDefaultIdentifier,
  getTokenConfigReadonly,
  parseDurationToMs,
  type RateLimitCheckResult,
  type RateLimiterAdapter,
  type RateLimitResultData,
  type RateLimitTier,
  type RateLimitTierConfig,
  type RateLimitTiersOverride,
  type ReadonlyTokenConfigMap,
  type StorePrimitives,
  type TokenConfig,
  tokenConfigSnapshot,
} from "@g14o/ratelimit";
export type {
  CreateRateLimitOptions,
  RateLimitClient,
  RateLimitOptions,
} from "./create-rate-limit-client";
export { createRateLimit } from "./create-rate-limit-client";
