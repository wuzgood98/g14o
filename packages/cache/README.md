# @g14o/cache

Framework-agnostic Redis-backed caching with in-memory fallbacks for development and static build phases. Works with any Node.js server runtime (Next.js App Router, Hono, etc.).
## Install

```bash
pnpm add @g14o/cache @upstash/redis
```

`@upstash/redis` is a peer dependency — add it when using Redis-backed cache in production.

## Setup

Create an app-owned client in `lib/cache.ts`:

```ts
import { createCache } from "@g14o/cache";
import { logger } from "@/lib/logger";

export const { withCache, invalidateCache } = createCache({
  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  },
  logger,
});
```

### Custom TTL

```ts
export const { withCache, getTTL } = createCache({
  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  },
  ttl: {
    development: { short: 30, long: 900 },
    production: { medium: 3600 },
  },
});
```

## Examples

### Wrap a server function with `withCache`

Functions passed to `withCache` must return `{ ok: true, data }` or `{ ok: false, error, status }`:

```ts
// lib/users.ts
import { withCache } from "@/lib/cache";

async function getUsers() {
  return fetchUsersFromDb();
}

export const getUsersCached = withCache(getUsers, {
  ttl: "medium",
  prefix: "users",
});
```

### Parameterized cache with a custom key

```ts
import { createListCacheKey, withCache } from "@/lib/cache";

export const listUsersCached = withCache(listUsers, {
  prefix: "users",
  keyGenerator: (filters) => createListCacheKey("users", filters),
  ttl: "short",
});
```

### Invalidate after a mutation

```ts
import { createEntityCacheKey } from "@g14o/cache";
import { invalidateCache, invalidateCacheKey } from "@/lib/cache";

await updateUser(id, data);
await invalidateCacheKey(createEntityCacheKey("user", id));
await invalidateCache("*", { prefix: "users" }); // list keys matching users:*
```

### Shared Redis client

Reuse an existing `@upstash/redis` client across your app:

```ts
// lib/redis.ts
import { Redis } from "@upstash/redis";

export const redis = Redis.fromEnv();
```

```ts
// lib/cache.ts
import { createCache } from "@g14o/cache";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

export const { withCache, invalidateCache } = createCache({ redis, logger });
```

### Build vs runtime

By default, `inMemoryDuringBuild` is `true`: during static build phases (Next.js sets `NEXT_PHASE` to `phase-production-build` or `phase-export` during `next build` / export), cache uses an in-memory adapter so prerender does not call Upstash. At runtime in production, Redis is used when configured. No `next` dependency is required — detection uses the `NEXT_PHASE` environment variable when present.

To opt into Redis during builds (debugging only):

```ts
createCache({
  redis: { url: "...", token: "..." },
  inMemoryDuringBuild: false,
});
```

You can also import `isBuildLikePhase()` from `@g14o/cache/config` to branch on build phase in your own code.
See [`@g14o/core`](../core/README.md) for the full bundled documentation, or install `@g14o/core` if you also need utilities and rate limiting.

## Import paths

| Use case | Import |
|----------|--------|
| Cache factory and helpers | `import { createCache, createListCacheKey, withCache } from "@g14o/cache"` |
| Redis / env helpers | `import { createRedisClient, isBuildLikePhase, type Logger } from "@g14o/cache/config"` |

## Bundled alternative

For utils, cache, and rate limiting in one package:

```bash
pnpm add @g14o/core @upstash/redis
```

Import cache from `@g14o/core/cache` instead of `@g14o/cache`.
