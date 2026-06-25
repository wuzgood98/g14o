# @g14o/ratelimit

Framework-agnostic rate limiting with Upstash Redis. Works with any runtime that uses Web `Request` / `Response` (Next.js App Router, Hono, Cloudflare Workers, etc.).

## Install

```bash
pnpm add @g14o/ratelimit @upstash/redis @upstash/ratelimit
```

Peers are optional in `package.json` metadata for metadata-only installs; add both Upstash packages when using Redis-backed limits in production.

## Setup

Create an app-owned client in `lib/rate-limit.ts`:

```ts
import { createRateLimit } from "@g14o/ratelimit";
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

### Next.js App Router route

```ts
import { withRateLimit } from "@/lib/rate-limit";

export const POST = withRateLimit(
  async (req) => Response.json({ ok: true }),
  { tier: "moderate" }
);
```

### Manual check (middleware or custom flow)

Use `checkRateLimit` when you are not wrapping a route handler:

```ts
import { checkRateLimit } from "@/lib/rate-limit";

export async function handleRequest(req: Request) {
  const result = await checkRateLimit(req, { tier: "strict" });
  if (!result.ok) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }
  // ...
}
```

### Per-user rate limit

```ts
import { withUserRateLimit } from "@/lib/rate-limit";

export const POST = withUserRateLimit(
  async (req) => Response.json({ ok: true }),
  async (req) => req.headers.get("x-user-id"),
  { tier: "auth" }
);
```

### Custom identifier

```ts
import { withRateLimit } from "@/lib/rate-limit";

export const GET = withRateLimit(
  async (req) => Response.json({ ok: true }),
  {
    tier: "lenient",
    identifierFn: async (req) =>
      req.headers.get("x-api-key") ?? "anonymous",
  }
);
```

### Hono

```ts
import { Hono } from "hono";
import { createRateLimit } from "@g14o/ratelimit";

const { withRateLimit } = createRateLimit({
  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  },
});
const app = new Hono();

app.get(
  "/api",
  withRateLimit(
    async (req) =>
      new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      }),
    { tier: "moderate" }
  )
);
```

### Custom tiers

Override built-in tier limits when creating the client:

```ts
export const { withRateLimit } = createRateLimit({
  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  },
  tiers: {
    strict: { limit: 3, window: "30 s" },
    auth: { limit: 10 },
  },
});
```

### Build vs runtime

By default, `inMemoryDuringBuild` is `true`: during static build phases (Next.js sets `NEXT_PHASE` during `next build` / export), rate limiting uses an in-memory backend so prerender does not call Upstash. At runtime in production, Redis is used when configured.

```ts
import { createRateLimit } from "@g14o/ratelimit";

export const { withRateLimit } = createRateLimit({
  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  },
  inMemoryDuringBuild: true, // default
});
```

Import `isBuildLikePhase()` from `@g14o/ratelimit/config` if you need to detect build phase yourself.

For Next.js route handlers with `NextRequest` / `NextResponse` types, use [@g14o/ratelimit-nextjs](../nextjs/README.md).

## Import paths

| Use case | Import |
|----------|--------|
| Rate limit factory | `import { createRateLimit } from "@g14o/ratelimit"` |
| Redis / env helpers | `import { createRedisClient, isBuildLikePhase } from "@g14o/ratelimit/config"` |

## Next.js alternative

```bash
pnpm add @g14o/ratelimit-nextjs @upstash/redis @upstash/ratelimit next
```

Import rate limiting from `@g14o/ratelimit-nextjs` (uses `next/server` types).
