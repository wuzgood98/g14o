# hono-demo

Demo app for [@g14o/ratelimit-hono](../../packages/ratelimit/hono).

## Routes

| Method | Path | Pattern |
|--------|------|---------|
| GET | `/api/status` | `middleware({ tier: "lenient" })` |
| POST | `/api/chat` | `withRateLimit(handler, { tier: "moderate" })` |
| POST | `/api/user-action` | `userMiddleware` (requires `x-user-id` header) |

## Run

From the monorepo root:

```bash
pnpm demo:hono
```

Or from this directory:

```bash
pnpm dev
```

Optional Upstash credentials via `.env.local` at the repo root (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`). Without Redis, in-memory rate limiting is used in development.

## Typing `Bindings` and `Variables`

Pass your app's env when creating the client in `lib/ratelimit.ts`:

```ts
export const { withRateLimit } = createRateLimit<AppEnv>({ ... });
```

Handlers then get a typed `Context` automatically — inline on the app or in route modules:

```ts
app.post("/chat", withRateLimit((c) => {
  c.get("user")?.id;              // typed
  c.env.UPSTASH_REDIS_REST_URL;   // typed
  return c.json({ ok: true });
}));
```
