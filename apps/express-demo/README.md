# express-demo

Minimal Express server demonstrating [@g14o/ratelimit-express](https://docs.g14o.dev/packages/ratelimit-express).

## Setup

Copy `.env.example` to `.env.local` at the monorepo root (or set env vars directly):

```bash
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
PORT=3001
```

Without Upstash credentials, rate limits use the in-memory backend (development mode).

## Run

From the monorepo root:

```bash
pnpm demo:express
```

## Routes

| Method | Path | Pattern |
|--------|------|---------|
| `GET` | `/api/status` | `middleware({ tier: "lenient" })` |
| `POST` | `/api/chat` | `withRateLimit` with per-endpoint prefix |
| `POST` | `/api/user-action` | `userMiddleware` keyed on `x-user-id` header |

## Try it

```bash
curl http://localhost:3001/api/status
curl -X POST http://localhost:3001/api/chat
curl -X POST http://localhost:3001/api/user-action -H "x-user-id: demo-user"
```
