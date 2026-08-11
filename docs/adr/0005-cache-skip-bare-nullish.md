# Cache: skip bare nullish in withCache

`withCache` does not cache bare `null` or bare `undefined` return values. `CacheStore.get` uses `null` for missing keys, so caching bare `null` would be ambiguous; bare `undefined` must not negative-cache a "no value" outcome either.

When an intentional empty answer should be cached, callers return a `Result` (e.g. `{ ok: true, data: null }`) or a domain sentinel — not bare nullish. Store-level undefined serialization (`__g14o_undefined__` via `createStore`) remains for direct `store.set` writes.

**Considered options:** Keep caching bare `undefined` (prior behavior); add an opt-in `cacheNullish` flag. Rejected — both re-open ambiguity and push store-config work onto callers.

**Consequences:** Apps that relied on caching bare `undefined` as "not found" will re-invoke the wrapped function on each call until they return a cacheable shape.
