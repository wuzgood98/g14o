---
"@g14o/cache": minor
"@g14o/ratelimit": minor
"@g14o/paystack-better-auth": minor
---

Remove unused public exports and orphaned internals.

**@g14o/cache:** Drop `createCacheKeyGenerator`, `createCacheKeyFromArgs`, and public value re-exports of `CACHE_TTL` / `RedisCache` (`InMemoryCache` remains type-only for `CacheClient.inMemoryCache()`). Add `@g14o/cache/types` for `Result`, `Logger`, and related types. Strip unused pagination types.

**@g14o/ratelimit:** Stop re-exporting `shouldSkipRateLimit` and `redisStore` from the package root (`redisStore` remains on `@g14o/ratelimit/redis`). Strip unused pagination/`Result` types from internal types.

**@g14o/paystack-better-auth:** Remove deprecated `PaystackWebhookEventType` and unused webhook/status helper exports.
