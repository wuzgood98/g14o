import { createFileRoute } from "@tanstack/react-router";
import { EventsPanel } from "@/components/events-panel";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1 style={{ marginTop: 0 }}>@g14o/events — TanStack Start demo</h1>
      <p style={{ color: "#555" }}>
        Mount: <code>server.handlers.GET</code> on <code>/api/events</code>
      </p>
      <EventsPanel />
    </main>
  );
}
