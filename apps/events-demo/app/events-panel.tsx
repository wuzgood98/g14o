"use client";

import { useCallback, useState } from "react";
import { useChannel, useEvent, useEventStatus } from "@/lib/events-client";
import { logger } from "@/lib/logger";

interface ActivityEntry {
  event: string;
  id: string;
  payload: unknown;
  timestamp: string;
}

interface NotifyResult {
  channel?: string;
  error?: string;
  event?: string;
  ok: boolean;
}

const sectionStyle = {
  marginTop: "1.5rem",
  padding: "1.25rem",
  border: "1px solid #ddd",
  borderRadius: 8,
} as const;

const buttonStyle = {
  padding: "0.5rem 1rem",
  cursor: "pointer",
  borderRadius: 6,
  border: "1px solid #ccc",
  background: "#f5f5f5",
  marginRight: "0.5rem",
  marginBottom: "0.5rem",
} as const;

const logStyle = {
  marginTop: "0.75rem",
  padding: "0.75rem",
  background: "#fafafa",
  border: "1px solid #eee",
  borderRadius: 6,
  fontSize: 13,
  maxHeight: 180,
  overflowY: "auto" as const,
};

export function EventsPanel() {
  const status = useEventStatus();
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);
  const [demoPingPayload, setDemoPingPayload] = useState<string | null>(null);

  const appendActivity = useCallback((eventName: string, payload: unknown) => {
    setActivityLog((current) =>
      [
        {
          id: crypto.randomUUID(),
          event: eventName,
          payload,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...current,
      ].slice(0, 50)
    );
  }, []);

  useChannel("demo");
  useChannel("room-1");

  const { status: listenStatus } = useEvent({
    channels: ["demo", "room-1"],
    events: ["demo.ping", "demo.notification"],
    onData({ event: eventName, data, channel }) {
      logger.info(`${eventName} on ${channel}:`, data);
      appendActivity(`${eventName}@${channel}`, data);
      if (eventName === "demo.ping") {
        setDemoPingPayload(data.message);
      }
    },
  });

  const broadcastFromServer = async (): Promise<void> => {
    setBroadcastStatus(null);

    try {
      const response = await fetch("/api/notify", { method: "POST" });
      const data = (await response.json()) as NotifyResult;
      if (!(response.ok && data.ok)) {
        setBroadcastStatus(data.error ?? "Server broadcast failed.");
        return;
      }
      setBroadcastStatus(
        `Broadcast "${data.event}" on channel "${data.channel ?? "room-1"}".`
      );
    } catch (error) {
      logger.error(error, "broadcast from server failed");
      setBroadcastStatus(
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  return (
    <div>
      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Realtime (SSE)</h2>
        <p style={{ color: "#555", fontSize: 14 }}>
          Connection: <code>{status}</code> / listen <code>{listenStatus}</code>
          . Channels <code>demo</code> and <code>room-1</code> via{" "}
          <code>useChannel</code> + <code>useEvent</code>.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Activity log</h2>
        <div style={logStyle}>
          {activityLog.length === 0 ? (
            <p style={{ color: "#888", margin: 0 }}>No events yet.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
              {activityLog.map((entry) => (
                <li key={entry.id}>
                  [{entry.timestamp}] <code>{entry.event}</code>{" "}
                  {JSON.stringify(entry.payload)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Server → client</h2>
        <p style={{ color: "#555", fontSize: 14 }}>
          POST <code>/api/notify</code> calls{" "}
          <code>event.channel(&quot;room-1&quot;).emit(...)</code>.
        </p>
        <button onClick={broadcastFromServer} style={buttonStyle} type="button">
          Broadcast demo.ping from server
        </button>
        {broadcastStatus ? (
          <p style={{ fontSize: 14, marginBottom: 0 }}>{broadcastStatus}</p>
        ) : null}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Demo ping payload</h2>
        <p style={{ color: "#555", fontSize: 14 }}>
          {demoPingPayload ?? "No payload yet."}
        </p>
      </section>
    </div>
  );
}
