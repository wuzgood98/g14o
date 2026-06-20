---
"@g14o/core": major
"@g14o/cache": major
"@g14o/ratelimit": major
---

Remove deprecated global singleton APIs (`configureUtils`, top-level `withCache`, `getRateLimiter`, and related exports). Use `createCache()` and `createRateLimit()` factory instances instead.

Fix `inMemoryCache()` so `clearAllCache()` and `getCacheStats()` no longer initialize Redis as a side effect.

Delete the unpublished `@g14o/utils` shim package; import from `@g14o/core` directly.
