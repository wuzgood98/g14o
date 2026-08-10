import { describe, expect, it } from "vitest";
import { createSseSession } from "./sse-session";

describe("createSseSession", () => {
  it("writes meta frames and data frames on the combined stream", async () => {
    const { connectionId, stream, writeData, writeMeta } = createSseSession({
      connectionId: "conn-1",
    });
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    writeMeta({ connectionId });

    writeData({
      event: "demo.ping",
      payload: { message: "hello" },
      id: "1",
      timestamp: 123,
    });

    const first = decoder.decode((await reader.read()).value);
    expect(first).toBe('event: meta\ndata: {"connectionId":"conn-1"}\n\n');

    const second = decoder.decode((await reader.read()).value);
    expect(second).toBe(
      'data: {"event":"demo.ping","payload":{"message":"hello"},"id":"1","timestamp":123}\n\n'
    );

    await reader.cancel();
  });

  it("writes keepalive comment frames", async () => {
    const { stream, writeKeepalive } = createSseSession({
      connectionId: "conn-keepalive",
    });
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    writeKeepalive();

    const { value } = await reader.read();
    expect(decoder.decode(value)).toBe(": keepalive\n\n");
    await reader.cancel();
  });

  it("writes proactive reconnect meta frames", async () => {
    const { stream, writeMeta } = createSseSession({
      connectionId: "conn-reconnect",
    });
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    writeMeta({ reconnect: true });

    const { value } = await reader.read();
    expect(decoder.decode(value)).toBe(
      'event: meta\ndata: {"reconnect":true}\n\n'
    );
    await reader.cancel();
  });
});
