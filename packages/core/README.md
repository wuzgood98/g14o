# @g14o/core

Core utilities, cache, and rate limiting for Next.js applications.

## Install

```bash
pnpm add @g14o/core
```

Peer dependency: `next` (>=15) when using `@g14o/core/cache` or `@g14o/core/ratelimit`.

Optional: install `@upstash/redis` only if you pass `Redis.fromEnv()` to the cache/rate-limit factories.

## Setup

Create app-owned clients in `lib/cache.ts` and `lib/rate-limit.ts`.

**Recommended — URL + token (no `@upstash/redis` in your app):**

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

**Alternative — pass an existing Redis client when you already use `@upstash/redis`:**

```ts
import { Redis } from "@upstash/redis";
import { createCache } from "@g14o/core/cache";
import { logger } from "@/lib/logger";

export const { withCache } = createCache({
  redis: Redis.fromEnv(),
  logger,
});
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
| Shared types | `import type { Result } from "@g14o/core/types"` |
| Redis helpers | `import { createRedisClient, type RedisCredentials } from "@g14o/core/config"` |
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

## Future packages

Independent packages such as `@g14o/env` and `@g14o/next-env` will live alongside `@g14o/core` under the `@g14o/*` scope and can be installed separately when needed.

## Testing before publish

```bash
pnpm test
pnpm build
pnpm typecheck
pnpm dlx ultracite check packages/core packages/utils packages/cache packages/ratelimit
pnpm test:dist
```

Optional Upstash integration tests (dedicated test database; skipped when credentials are missing):

```bash
# Copy .env.example → .env.local and set UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
pnpm --filter @g14o/core test:integration
```

## Publish

```bash
pnpm --filter @g14o/core build
pnpm --filter @g14o/core publish --access public
```

Shim packages (`@g14o/utils`, `@g14o/cache`, `@g14o/ratelimit`) remain in the monorepo for migration but are not published; use `@g14o/core` only.
