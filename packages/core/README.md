# @g14o/core

Core utilities and shared types for Next.js applications.

## Install

`@g14o/core` has **no runtime dependencies**. Install optional peers when using Redis config helpers:

| Use case | Command |
|----------|---------|
| Utilities + types only | `pnpm add @g14o/core` |
| Redis config helpers | `pnpm add @g14o/core @upstash/redis` |

For cache and rate limiting, use the standalone packages [@g14o/cache](../cache/README.md) and [@g14o/ratelimit-nextjs](../ratelimit/nextjs/README.md) (or framework-agnostic [@g14o/ratelimit](../ratelimit/core/README.md)).

## Import paths

| Use case | Import |
|----------|--------|
| Utility functions | `import { fetcher, mutationFn } from "@g14o/core"` |
| Shared types (`Result`, `Logger`, …) | `import type { Result, Logger } from "@g14o/core/types"` |
| Redis / env helpers | `import { createRedisClient, type RedisCredentials } from "@g14o/core/config"` |

## Related packages

| Package | Use case |
|---------|----------|
| [@g14o/cache](../cache/README.md) | Redis-backed caching with `createCache()` / `withCache()` |
| [@g14o/ratelimit-nextjs](../ratelimit/nextjs/README.md) | Next.js rate limiting (`NextRequest` / `NextResponse`) |
| [@g14o/ratelimit](../ratelimit/core/README.md) | Framework-agnostic rate limiting (`Request` / `Response`) |

## Examples

### Fetch helper

```ts
import { fetcher } from "@g14o/core";
import type { Result } from "@g14o/core/types";

const data = await fetcher<User[]>("/api/users");
```

### Redis client

```ts
import { createRedisClient } from "@g14o/core/config";

const redis = createRedisClient({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
```
