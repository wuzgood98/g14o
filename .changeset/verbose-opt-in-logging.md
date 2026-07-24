---
"@g14o/cache": minor
"@g14o/ratelimit": minor
"@g14o/ratelimit-nextjs": minor
"@g14o/ratelimit-express": minor
"@g14o/ratelimit-hono": minor
---

Replace injectable `logger` with opt-in `verbose` logging.

**Breaking:** remove the `logger` option and public `Logger` / `noopLogger` exports from cache and ratelimit. Pass `verbose: true` for console diagnostics.
