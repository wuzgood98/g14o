# @g14o/ratelimit-hono

> Documentation: [docs.g14o.dev/packages/ratelimit-hono](https://docs.g14o.dev/packages/ratelimit-hono)

Hono rate limiting with Upstash Redis. Middleware and route handler wrappers over [@g14o/ratelimit](https://github.com/wuzgood98/g14o/tree/main/packages/ratelimit/core).

## Install

```bash
pnpm add @g14o/ratelimit-hono @upstash/redis @upstash/ratelimit hono
```

`@upstash/redis` and `@upstash/ratelimit` are optional peers (in-memory fallback without Redis). `hono` is required.

## Setup

Create an app-owned client in `lib/ratelimit.ts`. Pass your Hono `Env` so handlers get typed `Context`:

```ts
import { createRateLimit } from "@g14o/ratelimit-hono";
import type { AppEnv } from "../types";

export const {
  middleware,
  withRateLimit,
  withUserRateLimit,
  userMiddleware,
  checkRateLimit,
} = createRateLimit<AppEnv>({
  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  },
});
```

### Typing Bindings and Variables

Define your env once, then pass it to the factory:

```ts
// src/types.ts
export interface Bindings {
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
}

export interface Variables {
  user: { id: string };
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
```

All helpers imported from `lib/ratelimit.ts` use `Context<AppEnv>` — inline on the app or in route modules:

```ts
app.post("/api/chat", withRateLimit((c) => {
  c.get("user")?.id;            // typed
  c.env.UPSTASH_REDIS_REST_URL; // typed
  return c.json({ ok: true });
}));
```

## Examples

### Route middleware (idiomatic Hono)

```ts
import { Hono } from "hono";
import { middleware } from "./lib/ratelimit";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

app.post(
  "/api/chat",
  middleware({ tier: "moderate", prefix: "@ratelimit:chat" }),
  (c) => c.json({ ok: true })
);
```

### Wrapped route handler

```ts
import { withRateLimit } from "./lib/ratelimit";

app.post(
  "/api/chat",
  withRateLimit((c) => c.json({ ok: true }), { tier: "moderate" })
);
```

### Per-user limits

Use a verified identity from upstream auth middleware — set on `Variables.user`, not client-controlled headers.

```ts
import { userMiddleware } from "./lib/ratelimit";

app.post(
  "/api/user-action",
  userMiddleware(async (c) => c.get("user")?.id ?? null, { tier: "auth" }),
  (c) => c.json({ ok: true })
);
```

## Framework alternatives

For Web `Request`/`Response` runtimes without Hono, use [@g14o/ratelimit](https://github.com/wuzgood98/g14o/tree/main/packages/ratelimit/core) directly.

For Next.js, use [@g14o/ratelimit-nextjs](https://docs.g14o.dev/packages/ratelimit-nextjs).

For Express, use [@g14o/ratelimit-express](https://docs.g14o.dev/packages/ratelimit-express).

## Import map

| Use case | Import |
|----------|--------|
| Rate limit factory | `import { createRateLimit } from "@g14o/ratelimit-hono"` |
| Hono Env type | `import type { Env } from "@g14o/ratelimit-hono"` |
| Custom store helpers | `import { createStore, defineStore } from "@g14o/ratelimit-hono"` |
| In-memory store | `import { memoryStore } from "@g14o/ratelimit-hono/memory"` |
| Upstash store | `import { upstashStore } from "@g14o/ratelimit-hono/upstash"` |
| Redis store (node-redis / ioredis) | `import { redisStore } from "@g14o/ratelimit/redis"` |
| Redis / env helpers | `import { createRedisClient, isBuildLikePhase } from "@g14o/ratelimit/config"` |
