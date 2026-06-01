---
"@g14o/core": minor
"@g14o/utils": minor
"@g14o/cache": minor
"@g14o/ratelimit": minor
---

### @g14o/core

- **feat:** Add `isNextBuildLikePhase()` in `@g14o/core/config` so cache/rate-limit use in-memory backends during Next.js `phase-production-build` and `phase-export`, fixing `DYNAMIC_SERVER_USAGE` when Redis REST runs during static prerender.
- **fix:** Clarify in-memory cache log message (`build/development mode`).
- **feat:** Expand `CacheClient` and `RateLimitClient` interfaces with additional methods and JSDoc.
- **test:** Cover build-phase behavior in `config.test.ts` and `cache/index.test.ts`.

### Monorepo

- **feat:** Add `apps/cache-demo` to manually verify build vs runtime cache behavior (not published).
