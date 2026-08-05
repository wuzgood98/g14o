# Events demo

Demonstrates `@g14o/events` realtime SSE with a pluggable stream backend.

## Stream backends

Chosen at process start from env (first match wins):

1. **Upstash** — `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` → `upstashStream`
2. **Redis** — `REDIS_URL` → `redisStream` (ioredis)
3. **Memory** — default when neither is set → `memoryStream`

Copy `.env.example` to `.env.local` and fill in credentials as needed. Confirm the live adapter with [GET /api/stream-info](http://localhost:3002/api/stream-info).

## Run

```bash
pnpm demo:events
```

Open the app, join happens via `useChannel` / `useEvent`, then use **Broadcast demo.ping from server**.
