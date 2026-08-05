# Events Hono demo

Demonstrates `@g14o/events` with a Hono API server and Vite React client.

## Run

```bash
pnpm demo:events-hono
```

- API: http://localhost:3010 (`GET /api/events` via `c.req.raw`)
- UI: http://localhost:3011 (Vite proxies `/api` to the API)

Use **Broadcast demo.ping from server** to emit over SSE.

## Mount

See [Handler — Hono](/packages/events/handler#hono) and `server/src/server.ts`.
