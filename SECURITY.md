# Security

## Socket Security alerts

Published packages in this monorepo are scanned by [Socket](https://socket.dev). The following package-level alerts have been reviewed and are documented here for transparency.

| Alert | Disposition | Notes |
|-------|-------------|-------|
| **Uses eval** | False positive | The `@g14o/ratelimit` Redis store (`packages/ratelimit/core/src/store/redis.ts`) calls redis/ioredis client methods named `eval`, `evalSha`/`evalsha`, and `script("LOAD", ...)` to run an atomic sliding-window Lua script **on the Redis server** via `EVAL`/`EVALSHA`. This is not JavaScript dynamic code execution. The package contains no `eval()`, `new Function()`, or `setTimeout`/`setInterval` with string arguments. Suppressed repo-wide in `socket.yml` (`issueRules.usesEval: false`). |
| **Environment variable access** | False positive | The published `@g14o/ratelimit` reads only `process.env.NODE_ENV` (adapter selection) and `process.env.NEXT_PHASE` (Next.js build/export detection) in `packages/ratelimit/core/src/env.ts`. No credentials or secrets are accessed; credential env reads exist only in non-published integration test helpers. Suppressed repo-wide in `socket.yml` (`issueRules.envVars: false`). |

## Reporting vulnerabilities

If you discover a security issue in any `@g14o/*` package, please report it via [GitHub Issues](https://github.com/wuzgood98/g14o/issues) or contact the maintainers through the repository.
