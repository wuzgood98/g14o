# Events: docs-only framework mounts (no adapter packages)

`@g14o/events` ships a Fetch API SSE `handler()` returning `{ GET: (request: Request) => Promise<Response> }`. We document per-framework mounting (Next.js, Hono, TanStack Start, Express via `getRequestListener`) instead of publishing separate `@g14o/events-hono` / `-express` packages like `@g14o/ratelimit-*`.

Ratelimit adapters exist because those frameworks need native middleware types, request identifiers, and 429 response shaping. Events SSE is a single GET that already speaks Web `Request`/`Response`; wiring is 1–5 lines for Fetch runtimes. Express is the exception and uses an external bridge (`@hono/node-server`), which we document explicitly rather than wrapping in a first-party package.

If we later need framework-native APIs that cannot stay Web-standard (e.g. typed Hono middleware with channel ACL on `Context`), revisit adapter packages.
