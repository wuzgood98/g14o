# @g14o/core

## 1.0.0

### Major Changes

- a41296c: **Root export is utils-only:** `configureUtils`, `createRedisClient`, `resolveRedisClient`, and other config helpers are no longer exported from `@g14o/core`. Import them from `@g14o/core/config`.
- **No bundled Upstash:** `@upstash/redis` and `@upstash/ratelimit` moved from `dependencies` to optional `peerDependencies`. Install peers when using `@g14o/core/config`, `/cache`, or `/ratelimit`.
- **`Logger` and `InMemoryEnvOptions`** live on `@g14o/core/types` (also re-exported from `@g14o/core/config`).

### Other

- Local `Duration` / `Unit` types for rate-limit windows (no type import from `@upstash/ratelimit`).
- `parseDurationToMs` supports `ms` and compact forms (e.g. `"60s"`, `"500ms"`).

## 0.5.0

### Minor Changes

- da8c47e: ### @g14o/core

  - **feat:** Add `inMemoryDuringNextBuild` to `createCache()`, `createRateLimit()`, and deprecated `configureUtils()`. Defaults to **`true`**: in-memory adapters during Next.js `phase-production-build` and `phase-export`, Redis at runtime in production. Set **`false`** to use Redis during build (may cause `DYNAMIC_SERVER_USAGE` and failed cache I/O during prerender).
  - **feat:** Export `InMemoryEnvOptions`, `isNextBuildLikePhase()`, and expanded JSDoc on build vs runtime behavior.
  - **fix:** Clarify in-memory cache log message (`build/development mode`).
  - **feat:** Expand `CacheClient` and `RateLimitClient` interfaces with additional methods and JSDoc.
  - **test:** Cover default-on and explicit opt-out in `config.test.ts` and `cache/index.test.ts`.

  ### Monorepo

  - **feat:** Add `apps/cache-demo` to manually verify build vs runtime cache behavior (not published).
