# g14o

![CI](https://github.com/wuzgood98/g14o/actions/workflows/ci.yml/badge.svg)

Monorepo for [`@g14o/*`](packages/core) npm packages. The primary publishable package is **[@g14o/core](packages/core/README.md)** — core utilities, cache, and rate limiting for Next.js applications.

## What it provides

- **Utilities** — fetch/mutation helpers, shared types, and Redis config helpers
- **Cache** — `createCache()` / `withCache()` with Upstash Redis (URL + token or an existing client)
- **Rate limiting** — `createRateLimit()` / `withRateLimit()` with the same Redis setup
- **Next.js build safety** — in-memory adapters during `next build` by default (`inMemoryDuringNextBuild: true`), Redis at runtime

## Install

```bash
pnpm add @g14o/core
```

Add peers for optional features: `@upstash/redis` for cache, plus `@upstash/ratelimit` and `next` for rate limiting.

See the [@g14o/core README](packages/core/README.md) for the install table, import paths, build vs runtime behavior, migration from legacy packages, and examples.

## Quick example

```ts
// lib/cache.ts
import { createCache } from "@g14o/core/cache";
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
| [`packages/core`](packages/core) | Source of truth; published as `@g14o/core` |
| [`packages/utils`](packages/utils), [`packages/cache`](packages/cache), [`packages/ratelimit`](packages/ratelimit) | Deprecated shims (not published) |
| [`apps/cache-demo`](apps/cache-demo) | Manual verification of build vs runtime cache behavior |
| [`apps/env-demo`](apps/env-demo) | Zod / Valibot / ArkType showcase for `@g14o/env-core` |
| [`apps/web`](apps/web) | Internal Next.js app |

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
