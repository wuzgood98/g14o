# @g14o/utils

Core utilities and shared types for Next.js applications.

## Install

```bash
pnpm add @g14o/utils @g14o/cache @g14o/ratelimit
```

Peer dependency: `next` (>=15) on `@g14o/cache` and `@g14o/ratelimit`.

Optional: install `@upstash/redis` only if you pass `Redis.fromEnv()` to the cache/rate-limit factories.

## Setup

Create app-owned clients in `lib/cache.ts` and `lib/rate-limit.ts`.

**Recommended — URL + token (no `@upstash/redis` in your app):**

```ts
// lib/cache.ts
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

```ts
// lib/rate-limit.ts
import { createRateLimit } from "@g14o/ratelimit";
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
import { createCache } from "@g14o/cache";

export const { withCache } = createCache({
  redis: Redis.fromEnv(),
  logger,
});
```

### Deprecated global setup

`configureUtils({ redis, logger })` still works for deprecated top-level exports but will be removed in v0.3.0. Prefer `createCache()` / `createRateLimit()`.

## Import paths

| Use case | Import |
|----------|--------|
| Utility functions | `import { fetcher, mutationFn } from "@g14o/utils"` |
| Shared types | `import type { Result } from "@g14o/utils/types"` |
| Redis helpers | `import { createRedisClient, type RedisCredentials } from "@g14o/utils/config"` |
| Cache factory | `import { createCache } from "@g14o/cache"` |
| Rate limit factory | `import { createRateLimit } from "@g14o/ratelimit"` |

## Examples

### Fetch helper

```ts
import { fetcher } from "@g14o/utils";
import type { Result } from "@g14o/utils/types";

const data = await fetcher<User[]>("/api/users");
```

### Cache (see [@g14o/cache](../cache/README.md))

```ts
import { withCache } from "@/lib/cache";

export const getUsersCached = withCache(getUsers, { ttl: "medium", prefix: "users" });
```

### Rate limit (see [@g14o/ratelimit](../ratelimit/README.md))

```ts
import { withRateLimit } from "@/lib/rate-limit";

export const GET = withRateLimit(handler, { tier: "moderate" });
```

## Testing before publish

```bash
pnpm test
pnpm build
pnpm typecheck
pnpm dlx ultracite check packages/utils packages/cache packages/ratelimit
pnpm test:dist
```

Optional Upstash integration tests (dedicated test database; skipped when credentials are missing):

```bash
# Copy .env.example → .env.local and set UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
pnpm test:integration
```

## Publish

```bash
pnpm --filter @g14o/utils build
pnpm --filter @g14o/cache build
pnpm --filter @g14o/ratelimit build
pnpm --filter @g14o/utils publish --access public
pnpm --filter @g14o/cache publish --access public
pnpm --filter @g14o/ratelimit publish --access public
```
