# Events framework demos (Hono, Express, TanStack Start)

We ship independent demo apps under `apps/events-*-demo` that prove each Handler Mount from the docs — SSE subscribe, server emit, and React client hooks — without publishing `@g14o/events-hono` or `-express` adapter packages.

Each demo copies a minimal schema and panel from `events-demo` rather than extracting a shared package, so the mount recipe stays visible in one folder. Hono and Express use a Vite React SPA with `/api` proxied to a Node API server; TanStack Start keeps UI and API in one process. Ports 3010–3030 avoid collisions with existing demos.

See ADR 0001 for why mounts stay docs-only; these demos are the executable proof.
