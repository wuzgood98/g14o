# @g14o/ratelimit-express

> Documentation: [docs.g14o.dev/packages/ratelimit-express](https://docs.g14o.dev/packages/ratelimit-express)

Express.js rate limiting with Upstash Redis. Middleware and route handler wrappers over [@g14o/ratelimit](https://github.com/wuzgood98/g14o/tree/main/packages/ratelimit/core).

## Install

```bash
pnpm add @g14o/ratelimit-express @upstash/redis @upstash/ratelimit express
```

`@upstash/redis` and `@upstash/ratelimit` are optional peers (in-memory fallback without Redis). `express` is required.

## Setup

Create an app-owned client in `lib/ratelimit.ts`:

```ts
import { createRateLimit } from "@g14o/ratelimit-express";

export const {
  middleware,
  withRateLimit,
  withUserRateLimit,
  checkRateLimit,
} = createRateLimit({
  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  },
});
```

## Examples

### Route middleware (idiomatic Express)

```ts
import express from "express";
import { middleware } from "./lib/ratelimit";

const app = express();

app.post(
  "/api/chat",
  middleware({ tier: "moderate", prefix: "@ratelimit:chat" }),
  (req, res) => res.json({ ok: true })
);
```

### Wrapped route handler

```ts
import { withRateLimit } from "./lib/ratelimit";

app.post(
  "/api/chat",
  withRateLimit(async (req, res) => res.json({ ok: true }), {
    tier: "moderate",
  })
);
```

### Per-user limits

```ts
import { userMiddleware } from "./lib/ratelimit";

app.post(
  "/api/user-action",
  userMiddleware(async (req) => req.get("x-user-id"), { tier: "auth" }),
  (req, res) => res.json({ ok: true })
);
```

## Demo

See [apps/express-demo](https://github.com/wuzgood98/g14o/tree/main/apps/express-demo) in the monorepo.

## Framework alternatives

For Web `Request`/`Response` runtimes without Hono, use [@g14o/ratelimit](https://github.com/wuzgood98/g14o/tree/main/packages/ratelimit/core) directly.

For Next.js, use [@g14o/ratelimit-nextjs](https://docs.g14o.dev/packages/ratelimit-nextjs).

For Hono, use [@g14o/ratelimit-hono](https://docs.g14o.dev/packages/ratelimit-hono).

## Import map

| Use case | Import |
|----------|--------|
| Rate limit factory | `import { createRateLimit } from "@g14o/ratelimit-express"` |
| Redis / env helpers | `import { createRedisClient, isBuildLikePhase } from "@g14o/ratelimit/config"` |
