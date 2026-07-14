# g14o

![CI](https://github.com/wuzgood98/g14o/actions/workflows/ci.yml/badge.svg)

Monorepo for [`@g14o/*`](packages/cache) npm packages.

## What it provides

- **[@g14o/cache](packages/cache/README.md)** — `createCache()` / `withCache()` with Upstash Redis
- **[@g14o/ratelimit](packages/ratelimit/core/README.md)** — framework-agnostic rate limiting (`Request` / `Response`)
- **[@g14o/ratelimit-nextjs](packages/ratelimit/nextjs/README.md)** — Next.js rate limiting (`NextRequest` / `NextResponse`)
- **[@g14o/env-core](packages/env-core/README.md)** — typesafe environment variables via Standard Schema
- **[@g14o/paystack](packages/paystack/README.md)** — paystack API client
- **[@g14o/paystack-better-auth](packages/paystack-better-auth/README.md)** — paystack billing plugin for Better Auth

## Install

```bash
pnpm add @g14o/cache @upstash/redis
pnpm add @g14o/ratelimit @upstash/redis @upstash/ratelimit
pnpm add @g14o/ratelimit-nextjs @upstash/redis @upstash/ratelimit next
pnpm add @g14o/paystack zod
pnpm add @g14o/paystack @g14o/paystack-better-auth better-auth zod
```

See each package guide in the [documentation](https://docs.g14o.dev) or package README for setup, import paths, and examples.

## Quick example

```ts
// lib/cache.ts
import { createCache } from "@g14o/cache";
import { logger } from "@/lib/logger";

export const { withCache, invalidateCache } = createCache({
  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  },
  logger,
});
```

## Monorepo layout

| Path | Purpose |
|------|---------|
| [`packages/cache`](packages/cache) | Standalone cache package |
| [`packages/ratelimit/core`](packages/ratelimit/core), [`packages/ratelimit/nextjs`](packages/ratelimit/nextjs) | Rate limiting (agnostic + Next.js) |
| [`packages/env-core`](packages/env-core) | Environment variable validation |
| [`packages/paystack`](packages/paystack) | Paystack API client |
| [`packages/paystack-better-auth`](packages/paystack-better-auth) | Paystack billing plugin for Better Auth |
| [`apps/cache-demo`](apps/cache-demo) | Manual verification of build vs runtime cache behavior |
| [`apps/env-demo`](apps/env-demo) | Zod / Valibot / ArkType showcase for `@g14o/env-core` |
| [`apps/paystack-demo`](apps/paystack-demo) | Paystack demo app |
| [`apps/docs`](apps/docs) | Documentation site ([docs.g14o.dev](https://docs.g14o.dev)) |

## Development

**Prerequisites:** Node `>=22.18`, [pnpm](https://pnpm.io) (see `packageManager` in [`package.json`](package.json)). CI uses Node 24.

```bash
pnpm install
pnpm dev              # turbo dev (all apps)
pnpm build            # turbo build
pnpm test             # turbo test
pnpm typecheck
pnpm check            # lint + format check (alias: pnpm lint)
pnpm fix              # auto-fix (alias: pnpm format)
pnpm test:dist        # smoke published tarballs
pnpm demo:cache       # cache-demo dev server
pnpm demo:cache:build # cache-demo production build
pnpm demo:env         # env-demo dev server (port 3001)
pnpm demo:env:build   # env-demo production build
pnpm docs            # docs dev server (port 3003)
pnpm docs:build      # docs production build
```

See [apps/cache-demo/README.md](apps/cache-demo/README.md) for verifying cache behavior during `next build` and at runtime.

See [apps/env-demo/README.md](apps/env-demo/README.md) for the environment validation showcase.

## Code quality

Linting and formatting run at the repo root via [Ultracite](https://docs.ultracite.ai) (Biome). Pre-commit hooks run `ultracite fix` on staged files via Husky and lint-staged.

Diagnose setup issues with `pnpm dlx ultracite doctor`.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, workflow, and pull request guidelines.

## License

[MIT](LICENSE)
