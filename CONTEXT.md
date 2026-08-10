# g14o

Monorepo of TypeScript libraries for caching, rate limiting, environment validation, payments, and realtime events.

## Language

**Handler**:
The Fetch API SSE entrypoint that accepts a Web `Request` and returns a streaming `Response` for browser subscriptions.
_Avoid_: Framework adapter, route plugin

**SSE session**:
Server connection lifecycle behind `handler()` — auth, replay, live fan-out, and SSE framing for one GET connection.
_Avoid_: Treating transport as a public package seam; conflating with client wire codec

**Verbose diagnostics**:
Shared boolean + optional injectable `info`/`warn`/`error` via `@g14o/logger/verbose`.
_Avoid_: Per-package console helpers; conflating with structured `createLogger`

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

**Webhook Delivery**:
Verify, parse, and idempotently handle one inbound Paystack webhook through a single Request-first interface.
_Avoid_: Bare "webhook" as a term; conflating with Paystack's event catalog

**Delivery store**:
The claim / markProcessed / markFailed seam apps implement for webhook deduplication.
_Avoid_: Calling it a database table or queue

**Webhook event identity**:
The stable identifier Webhook Delivery computes for store claims; not a separate public concept.
_Avoid_: Exporting identity rules as the primary API

**Paystack resource**:
Shared meaning of Customer, Authorization, Plan, and Transaction across REST and webhooks.
_Avoid_: Treating REST envelope or webhook event payload as a second source of truth for those entities

**Response envelope**:
Paystack `{ status, message, data }` owned by the deep API-call module.
_Avoid_: Per-endpoint envelope parsing; treating HTTP status alone as success
