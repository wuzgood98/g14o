# @g14o/ratelimit

> Documentation: [docs.g14o.dev/packages/ratelimit](https://docs.g14o.dev/packages/ratelimit)

Framework-agnostic rate limiting with Upstash Redis. Works with any runtime that uses Web `Request` / `Response` (Next.js App Router, Hono, Cloudflare Workers, etc.) or adapters built on `RateLimitRequest` / `RateLimitResponse`.

`RateLimitClient` and `RateLimitOptions` accept optional type parameters for framework-specific request/response types (defaults: Web `Request` / `Response`; constraint: `RateLimitRequest` / `RateLimitResponse` for custom adapters).

## Install

```bash
pnpm add @g14o/ratelimit @upstash/redis @upstash/ratelimit
```

Peers are optional in `package.json` metadata for metadata-only installs; add both Upstash packages when using Redis-backed limits in production.

## Setup

Create an app-owned client in `lib/ratelimit.ts`:

```ts
import { createRateLimit } from "@g14o/ratelimit";
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

### Next.js App Router route

```ts
import { withRateLimit } from "@/lib/ratelimit";

export const POST = withRateLimit(
  async (req) => Response.json({ ok: true }),
  { tier: "moderate" }
);
```

### Manual check (middleware or custom flow)

Use `checkRateLimit` when you are not wrapping a route handler:

```ts
import { checkRateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const result = await checkRateLimit(req, { tier: "strict" });
  if (!result.ok) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }
  // ...
}
```

### Per-user rate limit

Use a verified identity from your auth provider — not client-controlled headers.

```ts
import { withUserRateLimit } from "@/lib/ratelimit";
import { getSession } from "@/lib/auth";

export const POST = withUserRateLimit(
  async (req) => Response.json({ ok: true }),
  async (req) => {
    const session = await getSession(req);
    return session?.user.id ?? null;
  },
  { tier: "auth" }
);
```

### Custom identifier

```ts
import { withRateLimit } from "@/lib/ratelimit";

export const GET = withRateLimit(
  async (req) => Response.json({ ok: true }),
  {
    tier: "lenient",
    identifierFn: async (req) =>
      req.headers.get("x-api-key") ?? "anonymous",
  }
);
```

### Custom tiers

Override built-in tier limits when creating the client:

```ts
export const { withRateLimit } = createRateLimit({
  redis: {
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
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
import { env } from "@/lib/env";

export const { withRateLimit } = createRateLimit({
  redis: {
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  },
  inMemoryDuringBuild: true, // default
});
```

Import `isBuildLikePhase()` from `@g14o/ratelimit/config` if you need to detect build phase yourself.

For Next.js route handlers with `NextRequest` / `NextResponse` types, use [@g14o/ratelimit-nextjs](https://github.com/wuzgood98/g14o/tree/main/packages/ratelimit/nextjs).

For Express middleware and route handlers, use [@g14o/ratelimit-express](https://docs.g14o.dev/packages/ratelimit-express).

For Hono middleware and route handlers, use [@g14o/ratelimit-hono](https://docs.g14o.dev/packages/ratelimit-hono).

### Custom framework adapters

Implement `RateLimitRequest` (`url` + `headers.get()`) for any HTTP framework:

```ts
import { createRateLimit, type RateLimitRequest } from "@g14o/ratelimit";

function adaptMyRequest(req: MyRequest): RateLimitRequest {
  return {
    url: req.fullUrl,
    headers: { get: (name) => req.header(name) ?? null },
  };
}

const { checkRateLimit } = createRateLimit<RateLimitRequest, never>({ env: "test" });
```

## Import paths

| Use case | Import |
|----------|--------|
| Rate limit (Next.js) | `import { createRateLimit } from "@g14o/ratelimit-nextjs"` |
| Rate limit (Express) | `import { createRateLimit } from "@g14o/ratelimit-express"` |
| Rate limit (Hono) | `import { createRateLimit } from "@g14o/ratelimit-hono"` |
| Redis / env helpers | `import { createRedisClient, isBuildLikePhase } from "@g14o/ratelimit/config"` |

## Next.js alternative

```bash
pnpm add @g14o/ratelimit-nextjs @upstash/redis @upstash/ratelimit next
```

Import rate limiting from `@g14o/ratelimit-nextjs` (uses `next/server` types).

## Express alternative

```bash
pnpm add @g14o/ratelimit-express @upstash/redis @upstash/ratelimit express
```

Import rate limiting from `@g14o/ratelimit-express` (middleware and route wrappers).

## Hono alternative

```bash
pnpm add @g14o/ratelimit-hono @upstash/redis @upstash/ratelimit hono
```

Import rate limiting from `@g14o/ratelimit-hono` (middleware and route wrappers).
