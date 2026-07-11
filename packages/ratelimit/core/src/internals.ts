/** biome-ignore lint/performance/noBarrelFile: backwards-compatible re-export shim */
export {
  getDefaultIdentifier,
  type RateLimitCheckResult,
  type RateLimitOptions,
  type RateLimitRequest,
  type RateLimitResponse,
  resolveUserIdentifier,
  type SkipRateLimitOption,
  shouldSkipRateLimit,
} from "./core/request";
export {
  getTokenConfigReadonly,
  type RateLimitTier,
  type ReadonlyTokenConfigMap,
  type TokenConfig,
  tokenConfigSnapshot,
} from "./core/tiers";
export type {
  RateLimiterAdapter,
  RateLimitResultData,
} from "./store/interface";
