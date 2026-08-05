import { describe, expect, it, vi } from "vitest";
import { createServerSseConnection } from "./server-sse-connection";

describe("createServerSseConnection", () => {
  it("writes meta frames and data frames on the combined stream", async () => {
    const { connectionId, stream, transport, writeMeta } =
      createServerSseConnection({ connectionId: "conn-1" });
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    writeMeta({ connectionId });

    await transport.publish({
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

    await transport.close();
  });

  it("delivers inbound envelopes to subscribers via receive()", () => {
    const { transport } = createServerSseConnection();
    const handler = vi.fn();

    transport.subscribe(handler);
    transport.receive({
      event: "demo.ping",
      payload: { message: "inbound" },
      id: "2",
      timestamp: Date.now(),
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "demo.ping",
        payload: { message: "inbound" },
      })
    );
  });

  it("writes keepalive comment frames", async () => {
    const { stream, writeKeepalive } = createServerSseConnection({
      connectionId: "conn-keepalive",
    });
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    writeKeepalive();

    const { value } = await reader.read();
    expect(decoder.decode(value)).toBe(": keepalive\n\n");
  });

  it("writes proactive reconnect meta frames", async () => {
    const { stream, writeMeta } = createServerSseConnection({
      connectionId: "conn-reconnect",
    });
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    writeMeta({ reconnect: true });

    const { value } = await reader.read();
    expect(decoder.decode(value)).toBe(
      'event: meta\ndata: {"reconnect":true}\n\n'
    );
  });
});
