import { EventsPanel } from "./events-panel";
import { Providers } from "./providers";

export function App() {
  return (
    <Providers>
      <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
        <h1 style={{ marginTop: 0 }}>@g14o/events — Hono demo</h1>
        <p style={{ color: "#555" }}>
          Mount: <code>GET(c.req.raw)</code> on <code>/api/events</code>
        </p>
        <EventsPanel />
      </main>
    </Providers>
  );
}
