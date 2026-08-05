import { EventsPanel } from "@/app/events-panel";

export default function Page() {
  return (
    <main style={{ padding: "2rem", maxWidth: 960 }}>
      <h1>@g14o/events demo</h1>
      <p style={{ color: "#555" }}>
        Realtime SSE over a pluggable stream backend. Set Upstash REST
        credentials or <code>REDIS_URL</code> to use Redis; otherwise the demo
        falls back to memory. Active adapter:{" "}
        <a href="/api/stream-info">GET /api/stream-info</a>.
      </p>
      <EventsPanel />
    </main>
  );
}
