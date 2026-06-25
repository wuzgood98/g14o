# @g14o/ratelimit-nextjs

Next.js rate limiting with Upstash Redis. Typed for `NextRequest` / `NextResponse` route handlers; delegates to [@g14o/ratelimit](../core/README.md) at runtime.

## Install

```bash
pnpm add @g14o/ratelimit-nextjs @upstash/redis @upstash/ratelimit next
```

Peers are optional in `package.json` metadata for metadata-only installs; add Upstash packages and `next` when using Redis-backed limits in production.

## Setup

Create an app-owned client in `lib/rate-limit.ts`:

```ts
import { createRateLimit } from "@g14o/ratelimit-nextjs";
import { logger } from "@/lib/logger";

export const { withRateLimit, checkRateLimit, withUserRateLimit } =
  createRateLimit({
    redis: {
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
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

```ts
import { NextResponse } from "next/server";
import { withUserRateLimit } from "@/lib/rate-limit";

export const POST = withUserRateLimit(
  async (req) => NextResponse.json({ ok: true }),
  async (req) => req.headers.get("x-user-id"),
  { tier: "write" }
);
```

## Build vs runtime

During `next build`, limits use an in-memory backend by default (`inMemoryDuringBuild: true`). At runtime in production, Upstash Redis is required.

Import `isBuildLikePhase()` from `@g14o/ratelimit/config` if you need to detect build phase yourself.

## Framework-agnostic alternative

For Hono, Workers, or other Web `Request` / `Response` runtimes, use [@g14o/ratelimit](../core/README.md) directly.

## Import map

| Use case | Import |
|----------|--------|
| Rate limit factory | `import { createRateLimit } from "@g14o/ratelimit-nextjs"` |
| Redis / env helpers | `import { createRedisClient, isBuildLikePhase } from "@g14o/ratelimit/config"` |
