# Cache demo

Minimal Next.js app to verify `@g14o/core` cache behavior during `next build` and at runtime. It mirrors the cozy-haven pattern: the home page calls `withCache` during server render while static pages are generated.

## Setup

From the monorepo root:

```bash
pnpm install
```

Optional — copy env for runtime Redis testing:

```bash
cp apps/cache-demo/.env.example apps/cache-demo/.env.local
# Fill in UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
```

## Verify build (no Redis required)

```bash
pnpm demo:cache:build
```

Or from this directory:

```bash
NODE_ENV=production pnpm build
```

**Expected:**

- Build completes successfully
- Logs include `Using in-memory cache (build/development mode)` during static generation
- **No** `DYNAMIC_SERVER_USAGE`, `Cache read error`, or `Cache write error` messages

## Verify build with Redis credentials

With `apps/cache-demo/.env.local` populated, run the same build command. Redis is still not used during prerender (build phase uses in-memory); the build should remain clean.

## Verify runtime (Redis required)

```bash
pnpm demo:cache
# or: pnpm --filter cache-demo start   (after build)
```

1. Open [http://localhost:3000/api/cache-info](http://localhost:3000/api/cache-info) — expect `"adapter": "redis"` when credentials are set.
2. Load [http://localhost:3000](http://localhost:3000) twice — the second request should log cache hits for `landing:categories` and `landing:featured`.

Without Redis credentials and `NODE_ENV=production`, `next start` will fail when the cache adapter initializes (Redis is required at runtime in production).

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm demo:cache` | Dev server |
| `pnpm demo:cache:build` | Production build |
