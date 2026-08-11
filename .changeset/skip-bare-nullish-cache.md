---
"@g14o/cache": minor
---

Stop caching bare `null` and bare `undefined` return values in `withCache`. Previously only `null` was skipped; `undefined` was cached and served as a hit. Intentional empty answers should use a `Result` or domain value. Direct `store.set` undefined round-trips via the store sentinel are unchanged.
