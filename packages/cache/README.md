# @g14o/cache

> Documentation: [docs.g14o.dev/packages/cache](https://docs.g14o.dev/packages/cache)

Framework-agnostic caching with pluggable stores (memory, Upstash, node-redis/ioredis). In-memory fallbacks apply automatically in development, test, and static build phases.

## Install

```bash
pnpm add @g14o/cache @upstash/redis
```

Install only the peer(s) matching your chosen store:

| Store | Peer dependency |
|-------|-----------------|
| Upstash | `@upstash/redis` |
| node-redis | `redis` |
| ioredis | `ioredis` |

## Setup

Create an app-owned client in `lib/cache.ts`:

```ts
import { createCache } from "@g14o/cache";
import { upstashStore } from "@g14o/cache/upstash";

export const { withCache, invalidateCache, invalidateCacheKey } = createCache({
  store: upstashStore({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  }),
  verbose: true,
});
```

### Other stores

```ts
import { memoryStore } from "@g14o/cache/memory";
import { redisStore } from "@g14o/cache/redis";

createCache({ store: memoryStore() });
createCache({ store: redisStore(redisClient) });
```

### Legacy `redis` option

The `redis` option still works and wraps `upstashStore` internally. Prefer `store: upstashStore(...)` for new projects.

### Custom store from raw KV primitives

```ts
import { createStore } from "@g14o/cache";

const store = createStore({
  async read(key) { /* return string | null */ },
  async write(key, value, ttlSeconds) { /* persist string */ },
  async remove(...keys) { /* return deleted count */ },
  async list(pattern) { /* return matching keys */ },
});
```

By default, `createStore` JSON-serializes values. `undefined` (and other values that `JSON.stringify` cannot encode) are stored as a string sentinel and round-trip back to `undefined`. Pass custom `serialize` / `deserialize` if needed; serializers must return a `string` — if a custom serializer returns `undefined`, `createStore` coerces it to the undefined sentinel before `write()`.

```ts
createStore(primitives, {
  serialize: (value) => { /* must return string */ },
  deserialize: (raw) => { /* parse raw string */ },
  prefix: "app",
});
```

`null` return values from cached functions are not cached (`CacheStore.get` uses `null` for missing keys). `undefined` return values are cached and served as hits.
## Examples

### Wrap a server function with `withCache`

`withCache` accepts any async function. `Result`-shaped returns (`{ ok: true | false }`) cache successes by default; opt in to caching failures with `cacheFailures: true`.

```ts
export const getUsersCached = withCache(getUsers, {
  ttl: "medium",
  prefix: "users",
});
```

### Stale-while-revalidate

```ts
withCache(getUsers, {
  ttl: "medium",
  staleWhileRevalidate: 60, // serve stale for 60s while refreshing in background
});
```

### Negative caching (opt-in)

```ts
withCache(getUser, {
  cacheFailures: true,
});
```

Custom failure TTL:

```ts
withCache(getUser, {
  cacheFailures: { enabled: true, ttl: "medium" },
});
```

### Invalidate after a mutation

```ts
await invalidateCacheKey(createEntityCacheKey("user", id));
await invalidateCache("*", { prefix: "users" });
```

## Import paths

| Use case | Import |
|----------|--------|
| Cache factory and helpers | `@g14o/cache` |
| Memory store | `@g14o/cache/memory` |
| Upstash store | `@g14o/cache/upstash` |
| node-redis / ioredis store | `@g14o/cache/redis` |
| Shared types | `@g14o/cache/types` |
| Redis / env helpers | `@g14o/cache/config` |

## Build vs runtime

When no `store` is configured, development/test/build phases use in-memory cache automatically. Production requires an explicit `store` (or legacy `redis`).

See `inMemoryDuringBuild` and `isBuildLikePhase()` from `@g14o/cache/config`.
