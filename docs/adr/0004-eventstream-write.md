# EventStream: `write` replaces `append` + `publish`

`EventStream` exposes a single `write(channel, message) → cursor` that persists history and fans out live delivery. The bus and other callers no longer orchestrate a two-step append-then-publish sequence.

Breaking change — no compatibility shim. Persist-then-fan-out is an adapter invariant, not caller responsibility.
