---
"@g14o/cache": minor
---

Add pluggable cache stores matching the `@g14o/ratelimit` pattern.

- **Store API**: `createCache({ store: upstashStore(...) })` with subpath exports `@g14o/cache/memory`, `@g14o/cache/upstash`, and `@g14o/cache/redis` (node-redis/ioredis).
- **Custom backends**: `createStore(primitives)` builds a store from raw string KV operations; `defineStore` for full custom implementations.
- **Legacy `redis` option**: retained for backward compatibility (wraps `upstashStore`).
- **`withCache` enhancements**: cache plain (non-`Result`) return values; opt-in negative caching via `cacheFailures` (boolean or `{ enabled, ttl? }`); stale-while-revalidate via `staleWhileRevalidate`; client-level `keyGenerator` default.
- **Env fallback**: dev/test/build use in-memory when no store is configured; production requires an explicit store.
- **TTL overrides**: `createCache({ ttl })` accepts a flat `{ short, medium, long }` map (active environment) or nested `{ development, production }` overrides.
- **Negative caching**: `cacheFailures: true` defaults failure TTL to `"short"`; `{ enabled: true, ttl: "medium" }` overrides it. Standalone `failureTtl` removed.
