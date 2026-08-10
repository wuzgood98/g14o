# @g14o/cache

## 0.5.0

### Minor Changes

- 7c74d51: Deepen package architecture across six packages.

  **@g14o/events**

  - Replace `EventStream.append` + `publish` with single `write` — custom stream adapters must implement `write`
  - Collapse SSE handler + transport into an internal SSE session module behind `handler()`
  - Add optional verbose diagnostics via `verbose: boolean | VerboseLogger` (no runtime dependency on `@g14o/logger`)

  **@g14o/paystack**

  - Request-first Webhook Delivery as the primary webhook interface
  - Shared Paystack resource schemas and centralized `callPaystack` deep API call

  **@g14o/paystack-better-auth**

  - Handle `WebhookDeliveryError` from the updated Paystack client

  **@g14o/logger**

  - Add `@g14o/logger/verbose` with `resolveVerboseLogger` (`boolean | VerboseLogger`)

  **@g14o/cache** / **@g14o/ratelimit**

  - Add optional verbose diagnostics via `verbose: boolean | VerboseLogger` (no runtime dependency on `@g14o/logger`)

## 0.4.0

### Minor Changes

- 2bbd646: Replace injectable `logger` with opt-in `verbose` logging.

  **Breaking:** remove the `logger` option and public `Logger` / `noopLogger` exports from cache and ratelimit. Pass `verbose: true` for console diagnostics.

## 0.3.0

### Minor Changes

- dddc989: Add pluggable cache stores matching the `@g14o/ratelimit` pattern.

  - **Store API**: `createCache({ store: upstashStore(...) })` with subpath exports `@g14o/cache/memory`, `@g14o/cache/upstash`, and `@g14o/cache/redis` (node-redis/ioredis).
  - **Custom backends**: `createStore(primitives)` builds a store from raw string KV operations; `defineStore` for full custom implementations.
  - **Legacy `redis` option**: retained for backward compatibility (wraps `upstashStore`).
  - **`withCache` enhancements**: cache plain (non-`Result`) return values; opt-in negative caching via `cacheFailures` (boolean or `{ enabled, ttl? }`); stale-while-revalidate via `staleWhileRevalidate`; client-level `keyGenerator` default.
  - **Env fallback**: dev/test/build use in-memory when no store is configured; production requires an explicit store.
  - **TTL overrides**: `createCache({ ttl })` accepts a flat `{ short, medium, long }` map (active environment) or nested `{ development, production }` overrides.
  - **Negative caching**: `cacheFailures: true` defaults failure TTL to `"short"`; `{ enabled: true, ttl: "medium" }` overrides it. Standalone `failureTtl` removed.

## 0.2.0

### Minor Changes

- c5f775b: Remove unused public exports and orphaned internals.

  **@g14o/cache:** Drop `createCacheKeyGenerator`, `createCacheKeyFromArgs`, and public value re-exports of `CACHE_TTL` / `RedisCache` (`InMemoryCache` remains type-only for `CacheClient.inMemoryCache()`). Add `@g14o/cache/types` for `Result`, `Logger`, and related types. Strip unused pagination types.

  **@g14o/ratelimit:** Stop re-exporting `shouldSkipRateLimit` and `redisStore` from the package root (`redisStore` remains on `@g14o/ratelimit/redis`). Strip unused pagination/`Result` types from internal types.

  **@g14o/paystack-better-auth:** Remove deprecated `PaystackWebhookEventType` and unused webhook/status helper exports.

## 0.1.1

### Patch Changes

- Ship non-minified dist output for npm supply-chain visibility (Socket Security).

## 0.1.0

### Minor Changes

- Initial release of `@g14o/cache` — Redis-backed caching with factory API (`createCache`), in-memory dev/build fallbacks, and cache key helpers.
