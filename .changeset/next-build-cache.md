---
"@g14o/core": minor
"@g14o/utils": minor
"@g14o/cache": minor
"@g14o/ratelimit": minor
---

### @g14o/core

- **feat:** Add `inMemoryDuringNextBuild` to `createCache()`, `createRateLimit()`, and deprecated `configureUtils()`. Defaults to **`true`**: in-memory adapters during Next.js `phase-production-build` and `phase-export`, Redis at runtime in production. Set **`false`** to use Redis during build (may cause `DYNAMIC_SERVER_USAGE` and failed cache I/O during prerender).
- **feat:** Export `InMemoryEnvOptions`, `isNextBuildLikePhase()`, and expanded JSDoc on build vs runtime behavior.
- **fix:** Clarify in-memory cache log message (`build/development mode`).
- **feat:** Expand `CacheClient` and `RateLimitClient` interfaces with additional methods and JSDoc.
- **test:** Cover default-on and explicit opt-out in `config.test.ts` and `cache/index.test.ts`.

### Monorepo

- **feat:** Add `apps/cache-demo` to manually verify build vs runtime cache behavior (not published).
