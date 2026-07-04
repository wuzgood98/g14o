# @g14o/ratelimit-nextjs

> Documentation: [docs.g14o.dev/packages/ratelimit-nextjs](https://docs.g14o.dev/packages/ratelimit-nextjs)

Next.js rate limiting with Upstash Redis. Typed for `NextRequest` / `NextResponse` route handlers; delegates to [@g14o/ratelimit](https://github.com/wuzgood98/g14o/tree/main/packages/ratelimit/core) at runtime.

## Install

```bash
pnpm add @g14o/ratelimit-nextjs @upstash/redis @upstash/ratelimit next
```

`@upstash/redis` and `@upstash/ratelimit` are optional peers (in-memory fallback without Redis). `next` is required.

## Setup

Create an app-owned client in `lib/rate-limit.ts`:

```ts
import { createRateLimit } from "@g14o/ratelimit-nextjs";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";

export const { withRateLimit, checkRateLimit, withUserRateLimit } =
  createRateLimit({
    redis: {
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    },
    logger,
  });
```

## Examples

### App Router route

```ts
import { NextResponse } from "next/server";
import { withRateLimit } from "@/lib/rate-limit";

export const POST = withRateLimit(
  async (req) => NextResponse.json({ ok: true }),
  { tier: "moderate" }
);
```

### Per-user limits

Use a verified identity from your auth provider — not client-controlled headers.

```ts
import { NextResponse } from "next/server";
import { withUserRateLimit } from "@/lib/rate-limit";
import { getSession } from "@/lib/auth";

export const POST = withUserRateLimit(
  async (req) => NextResponse.json({ ok: true }),
  async (req) => {
    const session = await getSession(req);
    return session?.user.id ?? null;
  },
  { tier: "write" }
);
```

## Build vs runtime

During `next build`, limits use an in-memory backend by default (`inMemoryDuringBuild: true`). At runtime in production, Upstash Redis is required.

Import `isBuildLikePhase()` from `@g14o/ratelimit/config` if you need to detect build phase yourself.

## Framework alternatives

For Web `Request`/`Response` runtimes without Hono, use [@g14o/ratelimit](https://github.com/wuzgood98/g14o/tree/main/packages/ratelimit/core) directly.

For Express, use [@g14o/ratelimit-express](https://docs.g14o.dev/packages/ratelimit-express).

For Hono, use [@g14o/ratelimit-hono](https://docs.g14o.dev/packages/ratelimit-hono).

## Import map

| Use case | Import |
|----------|--------|
| Rate limit factory | `import { createRateLimit } from "@g14o/ratelimit-nextjs"` |
| Redis / env helpers | `import { createRedisClient, isBuildLikePhase } from "@g14o/ratelimit/config"` |
