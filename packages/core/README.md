# @g14o/core

Core utilities, cache, and rate limiting for Next.js applications.

## Install

`@g14o/core` has **no runtime dependencies**. Install peers for the subpaths you use:

| Subpath | Command |
|---------|---------|
| Utilities + types only | `pnpm add @g14o/core` |
| Cache | `pnpm add @g14o/core @upstash/redis` |
| Rate limiting | `pnpm add @g14o/core @upstash/redis @upstash/ratelimit next` |

The root entry (`@g14o/core`) is **utils-only** — config, Redis, cache, and rate limit live on subpaths (`@g14o/core/config`, `/cache`, `/ratelimit`). Peers are optional in `package.json` metadata so a utils-only install does not fail; you must add Upstash (and `next` for route wrappers) when importing those subpaths.

## Setup

Create app-owned clients in `lib/cache.ts` and `lib/rate-limit.ts`.

**Recommended — URL + token (`@upstash/redis` required as a peer):**

```ts
// lib/cache.ts
import { createCache } from "@g14o/core/cache";
import { logger } from "@/lib/logger";

export const { withCache, invalidateCache } = createCache({
  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  },
  logger,
});
```

```ts
// lib/rate-limit.ts
import { createRateLimit } from "@g14o/core/ratelimit";
import { logger } from "@/lib/logger";

export const { withRateLimit, checkRateLimit } = createRateLimit({
  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  },
  logger,
});
```

### Custom tiers and TTL

Tier names (`strict`, `moderate`, `lenient`, `auth`, `write`) and cache duration names (`short`, `medium`, `long`) are fixed. Override only the values; omitted keys keep factory defaults.

```ts
export const { withRateLimit } = createRateLimit({
  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
  },
  tiers: {
    strict: { limit: 3, window: "30 s" },
    auth: { limit: 10 },
  },
});
```

```ts
export const { withCache, getTTL } = createCache({
  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
  },
  ttl: {
    development: { short: 30, long: 900 },
    production: { medium: 3600 },
  },
});
```

**Alternative — pass a `Redis` client from `@upstash/redis` instead of URL + token:**

```ts
import { Redis } from "@upstash/redis";
import { createCache } from "@g14o/core/cache";
import { logger } from "@/lib/logger";

export const { withCache } = createCache({
  redis: Redis.fromEnv(),
  logger,
});
```

**Alternative — shared `lib/redis` client:**

Reuse one Upstash `Redis` instance across your app—for example realtime, queues, or any feature that already uses `@upstash/redis`. Export the client from `lib/redis.ts` and pass it to cache and rate limit. `@upstash/realtime` is only an example; it is not required by `@g14o/core`.

```ts
// lib/redis.ts -- example shared client
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
```

```ts
// lib/cache.ts
import { createCache } from "@g14o/core/cache";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

export const { withCache, invalidateCache } = createCache({ redis, logger });
```

```ts
// lib/rate-limit.ts
import { createRateLimit } from "@g14o/core/ratelimit";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

export const { withRateLimit, checkRateLimit } = createRateLimit({ redis, logger });
```

### Deprecated global setup

`configureUtils({ redis, logger })` still works for deprecated top-level exports but will be removed in a future release. Prefer `createCache()` / `createRateLimit()`.

### Next.js: build vs runtime

`withCache` and rate limiting are safe on server components that run during `next build` / static export when you use the default factory options.

| Phase | Adapter (production + Redis configured) |
|-------|----------------------------------------|
| `next build` / `phase-export` | **In-memory** (default) — avoids Upstash `no-store` fetch and `DYNAMIC_SERVER_USAGE` during prerender |
| Runtime requests | **Redis** |

By default, `inMemoryDuringNextBuild` is **`true`** (you can omit it). Entries cached in-memory during build are **not** copied to Upstash; Redis is populated when your server code runs again at runtime.

```ts
// Default — recommended for Next apps using withCache on prerendered pages
createCache({
  redis: { url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! },
  logger,
});

// Opt-out — use Redis during next build (may warn/fail cache I/O; routes may become dynamic)
createCache({
  redis: { url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! },
  logger,
  inMemoryDuringNextBuild: false,
});
```

Set `inMemoryDuringNextBuild: false` only for debugging or when you intentionally want Redis during prerender. Expect cache read/write warnings, fallback to uncached functions, and routes such as `/` may show as dynamic (`ƒ`) in the build output. Runtime server renders still use Redis normally.

The same option applies to `createRateLimit()`. For low-level checks, see `isNextBuildLikePhase()` and `isInMemoryEnv()` from `@g14o/core/config`.

## Import paths

| Use case | Import |
|----------|--------|
| Utility functions | `import { fetcher, mutationFn } from "@g14o/core"` |
| Shared types (`Result`, `Logger`, …) | `import type { Result, Logger } from "@g14o/core/types"` |
| Redis / env helpers | `import { createRedisClient, type RedisCredentials } from "@g14o/core/config"` |
| Cache factory | `import { createCache } from "@g14o/core/cache"` |
| Rate limit factory | `import { createRateLimit } from "@g14o/core/ratelimit"` |

## Migration from separate packages

If you previously installed `@g14o/utils`, `@g14o/cache`, and `@g14o/ratelimit`:

```bash
pnpm remove @g14o/utils @g14o/cache @g14o/ratelimit
pnpm add @g14o/core
```

| Old import | New import |
|------------|------------|
| `@g14o/utils` | `@g14o/core` |
| `@g14o/utils/types` | `@g14o/core/types` |
| `@g14o/utils/config` | `@g14o/core/config` |
| `@g14o/cache` | `@g14o/core/cache` |
| `@g14o/ratelimit` | `@g14o/core/ratelimit` |

The old package names remain available as deprecated shims for one release cycle.

## Examples

### Fetch helper

```ts
import { fetcher } from "@g14o/core";
import type { Result } from "@g14o/core/types";

const data = await fetcher<User[]>("/api/users");
```

### Cache

```ts
import { withCache } from "@/lib/cache";

export const getUsersCached = withCache(getUsers, { ttl: "medium", prefix: "users" });
```

### Rate limit

```ts
import { withRateLimit } from "@/lib/rate-limit";

export const GET = withRateLimit(handler, { tier: "moderate" });
```
