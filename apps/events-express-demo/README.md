# Events Express demo

Demonstrates `@g14o/events` with Express (`getRequestListener`) and a Vite React client.

## Run

```bash
pnpm demo:events-express
```

- API: http://localhost:3020 (`getRequestListener(handler().GET)` before body parsers)
- UI: http://localhost:3021

## Mount

See [Handler — Express](/packages/events/handler#express) and `server/src/server.ts`.
