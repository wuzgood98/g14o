/** biome-ignore-all lint/performance/noBarrelFile: public package entry re-export */
/**
 * Express.js rate limiting for `@g14o/ratelimit-express`.
 *
 * Use {@link createRateLimit} for app-owned instances (`lib/ratelimit.ts`).
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
  buildRateLimitExceededBody,
  buildRateLimitHeaders,
  computeRetryAfterSeconds,
  createStore,
  defineStore,
  getDefaultIdentifier,
  getTokenConfigReadonly,
  parseDurationToMs,
  type RateLimitCheckResult,
  type RateLimiterAdapter,
  type RateLimitRequest,
  type RateLimitResponse,
  type RateLimitResultData,
  type RateLimitTier,
  type RateLimitTierConfig,
  type RateLimitTiersOverride,
  RETRY_AFTER_DELAY_MS,
  type ReadonlyTokenConfigMap,
  type StorePrimitives,
  type TokenConfig,
  tokenConfigSnapshot,
} from "@g14o/ratelimit";
export { adaptExpressRequest } from "./adapt-request";
export {
  applyRateLimitHeaders,
  sendRateLimitExceeded,
} from "./apply-rate-limit-response";
export type {
  CreateRateLimitOptions,
  ExpressRateLimitClient,
  ExpressRateLimitOptions,
  RequestHandler,
} from "./create-rate-limit-client";
export { createRateLimit } from "./create-rate-limit-client";
