# g14o

Monorepo of TypeScript libraries for caching, rate limiting, environment validation, payments, and realtime events.

## Language

**Handler**:
The Fetch API SSE entrypoint that accepts a Web `Request` and returns a streaming `Response` for browser subscriptions.
_Avoid_: Framework adapter, route plugin

**Mount**:
Framework-specific wiring that calls `handler().GET` (or equivalent) — e.g. Next.js named export, Hono `c.req.raw`, Express `getRequestListener`.
_Avoid_: Claiming native Express support without a Fetch↔Node bridge

**Stream adapter**:
Pluggable `EventStream` backend (memory, Redis, Upstash) for cross-instance fan-out and replay.
_Avoid_: HTTP mount, route handler, framework adapter

**Event**:
The server-side bus instance (`new Event({ schema, stream })`) that validates, emits, and dispatches events.
_Avoid_: SSE message, browser event, DOM event

**Client**:
The React subscribe layer (`@g14o/events/client`): `EventProvider` and typed hooks over a shared EventSource. Browser subscribe only — no emit.
_Avoid_: DOM event, browser EventTarget, server Event bus

**Channel**:
An opaque delivery-scope string that controls who receives a fan-out emission (room, user, job, tenant, …). Distinct from event names and namespaces.
_Avoid_: Treating empty or absent channels as "everyone"; conflating with event names or namespaces

**Demo**:
A runnable app in `apps/*` that proves a Mount end-to-end (SSE + emit + client hooks).
_Avoid_: Adapter package, framework plugin
