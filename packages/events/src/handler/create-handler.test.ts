import { describe, expect, it, vi } from "vitest";
import { Event } from "../bus/event";
import { memoryStream } from "../stream/memory";
import { createMockSchema } from "../test-utils/schema";
import { handler } from "./create-handler";

describe("handler", () => {
  it("rejects via middleware before opening the stream", async () => {
    const event = new Event({
      schema: {
        "demo.ping": createMockSchema((value) => ({ value })),
      },
      stream: memoryStream(),
    });

    const { GET } = handler({
      event,
      middleware: () =>
        Response.json({ ok: false, error: "unauthorized" }, { status: 401 }),
    });

    const response = await GET(
      new Request("http://localhost/api/events?channel=demo")
    );

    expect(response.status).toBe(401);
  });

  it("replays stream history after last_ack on GET", async () => {
    const stream = memoryStream();
    const event = new Event({
      schema: {
        "demo.ping": createMockSchema((value) => ({ value })),
      },
      stream,
    });

    await event.channel("demo").emit("demo.ping", { message: "one" });
    await event.channel("demo").emit("demo.ping", { message: "two" });

    const history = await stream.readAfter("demo", undefined);
    expect(history.length).toBe(2);
    const firstId = history[0]?.id;

    const { GET } = handler({ event });
    const response = await GET(
      new Request(
        `http://localhost/api/events?channel=demo&last_ack_demo=${firstId}`
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const reader = response.body?.getReader();
    expect(reader).toBeTruthy();
    const decoder = new TextDecoder();
    let text = "";

    if (reader) {
      for (let index = 0; index < 8; index += 1) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        text += decoder.decode(value, { stream: true });
        if (text.includes("two")) {
          break;
        }
      }
      await reader.cancel();
    }

    expect(text).toContain("two");
    expect(text).not.toContain('"message":"one"');
  });

  it("fans live publishes to the SSE client", async () => {
    const stream = memoryStream();
    const event = new Event({
      schema: {
        "demo.ping": createMockSchema((value) => ({ value })),
      },
      stream,
    });

    const { GET } = handler({ event });
    const response = await GET(
      new Request("http://localhost/api/events?channel=demo")
    );
    const reader = response.body?.getReader();
    expect(reader).toBeTruthy();

    await event.channel("demo").emit("demo.ping", { message: "live" });

    const decoder = new TextDecoder();
    let text = "";
    if (reader) {
      await vi.waitFor(
        async () => {
          const { value } = await reader.read();
          if (value) {
            text += decoder.decode(value, { stream: true });
          }
          expect(text).toContain("live");
        },
        { timeout: 3000 }
      );
      await reader.cancel();
    }
  });

  it("signals reconnect after maxDurationSecs", async () => {
    vi.useFakeTimers();

    try {
      const event = new Event({
        schema: {
          "demo.ping": createMockSchema((value) => ({ value })),
        },
        stream: memoryStream(),
      });

      const { GET } = handler({ event, maxDurationSecs: 1 });
      const response = await GET(
        new Request("http://localhost/api/events?channel=demo")
      );

      expect(response.status).toBe(200);

      const reader = response.body?.getReader();
      expect(reader).toBeTruthy();

      const decoder = new TextDecoder();
      let text = "";

      const pump = (async () => {
        if (!reader) {
          return;
        }
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            text += decoder.decode(value, { stream: true });
          }
        } catch {
          // Stream closes after proactive reconnect cleanup.
        }
      })();

      await vi.advanceTimersByTimeAsync(1000);
      await pump;

      expect(text).toContain('"reconnect":true');
    } finally {
      vi.useRealTimers();
    }
  });
});
